const { makeEndpointSnapshotTests, makeEndpointPaginationTests, setupSnapshots } = require('../../../utils');

const periodOptions = [ 'day', 'week', 'month', 'year', 'all', undefined ];

describe('/v1/stats/packages', () => {
	before(() => {
		setupSnapshots(__filename);
	});

	makeStatsPackagesTests();
});

function makeStatsPackagesTests () {
	makeEndpointSnapshotTests('/v1/stats/packages{/type}{/period}{?by}', {
		period: 'month',
	}, [
		{
			by: [ 'hits', 'bandwidth', undefined ],
			type: [ 'gh', 'npm', undefined ],
			period: periodOptions,
		},
	]);

	makeEndpointPaginationTests('/v1/stats/packages');
}
