/**
 * Validates `body`, `params`, and `query` according to the provided schema
 * and copies the validated object to `ctx.state`. Properties not declared
 * in the schema are not copied.
 *
 * @param {{ body: Joi.Schema?, params: Joi.Schema?, query: Joi.Schema? }} options
 * @returns {Application.Middleware}
 */
module.exports = ({ body, params, query }) => {
	let validations = [
		{ name: 'body', schema: body },
		{ name: 'params', schema: params },
		{ name: 'query', schema: query },
	].filter(validation => validation.schema);

	return Object.assign(async (ctx, next) => {
		let isValid = validations.every((validation) => {
			let result = validateSingle(validation.schema, ctx[validation.name], ctx);
			ctx.state[validation.name] = result || {};

			return result;
		});

		return isValid && next();
	}, {
		schema: {
			body,
			params,
			query,
		},
		schemaKeys: {
			body: getSchemaKeys(body),
			params: getSchemaKeys(params),
			query: getSchemaKeys(query),
		},
		requiredSchemaKeys: {
			body: getRequiredSchemaKeys(body),
			params: getRequiredSchemaKeys(params),
			query: getRequiredSchemaKeys(query),
		},
		schemaDefaults: {
			body: getSchemaKeysDefaults(body),
			params: getSchemaKeysDefaults(params),
			query: getSchemaKeysDefaults(query),
		},
	});
};

/**
 * @param {Joi.Schema} schema
 * @returns {Router.IParamMiddleware<any, {}>}
 */
module.exports.param = (schema) => {
	return async (value, ctx, next) => {
		return validateSingle(schema, value, ctx) && next();
	};
};

module.exports.single = validateSingle;

/**
 * @param {Joi.Schema} schema
 * @param {*} value
 * @param {Application.ParameterizedContext} ctx
 * @returns {boolean|*}
 */
function validateSingle (schema, value, ctx) {
	let result = schema.validate(value, {
		abortEarly: false,
		allowUnknown: true,
		stripUnknown: true,
		errors: {
			wrap: {
				label: '`',
			},
		},
	});

	if (result.error) {
		ctx.body = {
			status: 400,
			message: `Invalid parameter value: ${_.sortBy(result.error.details, 'path').map(detail => detail.message).join(', ')}.`,
		};

		return false;
	}

	return result.value;
}

function getSchemaKeys (schema) {
	return schema ? Array.from(schema._ids._byKey.keys()) : undefined;
}

function getRequiredSchemaKeys (schema) {
	return schema ? Array.from(schema._ids._byKey.entries()).filter(([ , v ]) => v.schema._flags.presence === 'required').map(([ k ]) => k) : undefined;
}

function getSchemaKeysDefaults (schema) {
	return schema ? Object.fromEntries(Array.from(schema._ids._byKey.entries()).map(([ k, v ]) => [ k, String(typeof v.schema._flags.default === 'function' ? v.schema._flags.default() : v.schema._flags.default) ])) : undefined;
}
