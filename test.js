const Pool = require("pg").Client;
const connection = {
	connectionString:
		"postgres://doadmin:AVNS_iIGK-LkQKHLCKig@istanbulshopping-do-user-11377156-0.b.db.ondigitalocean.com:25060/defaultdb",
	ssl: {
		rejectUnauthorized: false,
	},
};

const testing = async () => {
	try {
		const pool = new Pool(connection);
		await pool.connect();
		const orders = await pool.query(
			"SELECT * FROM orders ORDER BY order_id ASC"
		);
		pool.end();
		console.log(orders);
	} catch (err) {
		console.log(err);
	}
};

testing();