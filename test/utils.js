const chai = require('chai');
const expect = chai.expect;

const path = require('path');
const urlTemplate = require('url-template');
require('./plugins/wrap-it');

// based on https://stackoverflow.com/a/43053803
const cartesian = (...sets) => {
	if (sets.length === 1) {
		return sets[0].map(i => [ i ]);
	}

	return sets.reduce((accumulator, currentSet) => {
		return accumulator.flatMap((resultItem) => {
			return currentSet.map(currentSetItem => [ resultItem, currentSetItem ].flat());
		});
	});
};

function getUriWithValues (template, values, defaults) {
	return urlTemplate.parse(template).expand(defaults ? _.defaults(values, defaults) : values);
}

function makeEndpointTest (uriTemplate, defaults, values, { status = 200 } = {}, note) {
	let getUri = full => getUriWithValues(uriTemplate, values, full);

	it(`GET ${getUri()}${note ? ` - ${note}` : ''}`, () => {
		return chai.request(server)
			.get(getUri())
			.then((response) => {
				expect(response).to.have.status(status);
				expect(response).to.have.header('Access-Control-Allow-Origin', '*');
				expect(response).to.have.header('Timing-Allow-Origin', '*');
				expect(response).to.have.header('Vary', 'Accept-Encoding');
				expect(response).to.be.json;

				if (status < 400) {
					expect(response).to.have.header('Cache-Control', 'public, stale-while-revalidate=3600, stale-if-error=86400');
				} else {
					expect(response).to.have.header('Cache-Control', 'no-cache, no-store, must-revalidate');
				}

				expect(response).to.matchSnapshot(getUri(defaults));
			});
	});
}

function makeEndpointTests (uriTemplate, defaults, testTemplates, options, note) {
	for (let testTemplate of testTemplates) {
		let templateKeys = Object.keys(testTemplate);
		let templateValues = Object.values(testTemplate).map(item => Array.isArray(item) ? item : [ item ]);
		let testCases = cartesian(...templateValues).map(test => _.zipObject(templateKeys, test));

		for (let testValues of testCases) {
			makeEndpointTest(uriTemplate, defaults, testValues, options, note);
		}
	}
}

function makePaginationTests (uri, params) {
	describe(`GET ${uri} - pagination`, () => {
		let first10;

		before(async () => {
			first10 = await chai.request(server)
				.get(uri)
				.query({ ...params, limit: 10 });
		});

		it(`returns at most 10 results`, async () => {
			expect(first10).to.have.status(200);
			expect(first10.body).to.have.length.lessThanOrEqual(10);
		});

		_.range(1, 11).forEach((index) => {
			it(`works with limit=1&page=${index}`, () => {
				return chai.request(server)
					.get(uri)
					.query({ ...params, limit: 1, page: index })
					.then((response) => {
						expect(response).to.have.status(200);
						expect(response.body).to.deep.equal(first10.body.slice(index - 1, index));
					});
			});
		});

		_.range(1, 6).forEach((index) => {
			it(`works with limit=2&page=${index}`, () => {
				return chai.request(server)
					.get(uri)
					.query({ ...params, limit: 2, page: index })
					.then((response) => {
						expect(response).to.have.status(200);
						expect(response.body).to.deep.equal(first10.body.slice((index - 1) * 2, (index - 1) * 2 + 2));
					});
			});
		});

		it('validates the limit param', () => {
			return chai.request(server)
				.get(uri)
				.query({ ...params, limit: -1 })
				.then((response) => {
					expect(response).to.have.status(400);
				});
		});

		it('validates the page param', () => {
			return chai.request(server)
				.get(uri)
				.query({ ...params, page: -1 })
				.then((response) => {
					expect(response).to.have.status(400);
				});
		});
	});
}

module.exports = {
	makeEndpointTests,
	makePaginationTests,
	setupSnapshots (file) {
		chaiSnapshotInstance.setCurrentFile(path.join(
			__dirname,
			'expected',
			path.relative(path.join(__dirname, 'tests'), path.dirname(file)),
			`${path.basename(file, path.extname(file))}.json`
		));
	},
};
