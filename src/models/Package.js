const Joi = require('joi');
const BaseModel = require('./BaseModel');

const schema = {
	id: Joi.number().integer().min(0).required().allow(null),
	name: Joi.string().max(255).required(),
	type: Joi.string().max(255).required(),
};

class Package extends BaseModel {
	static get table () {
		return 'package';
	}

	static get schema () {
		return schema;
	}

	static get unique () {
		return [ 'id', 'name', 'type' ];
	}

	constructor (properties = {}) {
		super();

		/** @type {number} */
		this.id = null;

		/** @type {string} */
		this.name = null;

		/** @type {string} */
		this.type = null;

		Object.assign(this, properties);
		return new Proxy(this, BaseModel.ProxyHandler);
	}

	static async getHitsByName (type, name, from, to) {
		let sql = db(this.table)
			.where({ type, name })
			.join(PackageVersion.table, `${this.table}.id`, '=', `${PackageVersion.table}.packageId`)
			.join(File.table, `${PackageVersion.table}.id`, '=', `${File.table}.packageVersionId`)
			.join(FileHits.table, `${File.table}.id`, '=', `${FileHits.table}.fileId`)
			.groupBy([ `${PackageVersion.table}.id`, `${FileHits.table}.date` ])
			.sum(`${FileHits.table}.hits as hits`);

		if (from instanceof Date) {
			sql.where(`${FileHits.table}.date`, '>=', from);
		}

		if (to instanceof Date) {
			sql.where(`${FileHits.table}.date`, '<=', to);
		}

		return _.map(_.groupBy(await sql.select([ `${PackageVersion.table}.version`, `${PackageVersion.table}.id`, `${FileHits.table}.date` ]), (record) => {
			return `${record.id}:${record.date}`;
		}), (record) => {
			return _.reduce(record, (t, c) => {
				t.hits += c.hits;
				return t;
			});
		});
	}

	static async getPackageRank (hits, from, to) {
		let _this = this;
		let sql = db.count('* as count').from(function () {
			this.from(_this.table)
				.join(PackageVersion.table, `${_this.table}.id`, '=', `${PackageVersion.table}.packageId`)
				.join(File.table, `${PackageVersion.table}.id`, '=', `${File.table}.packageVersionId`)
				.join(FileHits.table, `${File.table}.id`, '=', `${FileHits.table}.fileId`)
				.groupBy(`${Package.table}.id`)
				.havingRaw(`SUM(${FileHits.table}.hits) > ${hits}`);

			if (from instanceof Date) {
				this.where(`${FileHits.table}.date`, '>=', from);
			}

			if (to instanceof Date) {
				this.where(`${FileHits.table}.date`, '<=', to);
			}

			this.select(`${_this.table}.id`).as('t');
		});

		return (await sql.select().first()).count;
	}

	static async getSumDateHitsPerVersionByName (type, name, from, to) {
		return _.mapValues(_.groupBy(await Package.getHitsByName(type, name, from, to), item => item.date.toISOString().substr(0, 10)), (versionHits) => {
			return _.fromPairs(_.map(versionHits, entry => [ entry.version, entry.hits ]));
		});
	}

	static async getSumVersionHitsPerDateByName (type, name, from, to) {
		return _.mapValues(_.groupBy(await Package.getHitsByName(type, name, from, to), 'version'), (versionHits) => {
			return _.fromPairs(_.map(versionHits, entry => [ entry.date.toISOString().substr(0, 10), entry.hits ]));
		});
	}

	static async getTopPackages (from, to, limit = 100, page = 1) {
		let sql = db(this.table)
			.join(PackageVersion.table, `${this.table}.id`, '=', `${PackageVersion.table}.packageId`)
			.join(File.table, `${PackageVersion.table}.id`, '=', `${File.table}.packageVersionId`)
			.join(FileHits.table, `${File.table}.id`, '=', `${FileHits.table}.fileId`)
			.groupBy(`${Package.table}.id`)
			.sum(`${FileHits.table}.hits as hits`)
			.orderBy('hits', 'DESC')
			.limit(limit)
			.offset((page - 1) * limit);

		if (from instanceof Date) {
			sql.where(`${FileHits.table}.date`, '>=', from);
		}

		if (to instanceof Date) {
			sql.where(`${FileHits.table}.date`, '<=', to);
		}

		return sql.select([ `${Package.table}.type`, `${Package.table}.name` ]);
	}
}

module.exports = Package;

const PackageVersion = require('./PackageVersion');
const File = require('./File');
const FileHits = require('./FileHits');
