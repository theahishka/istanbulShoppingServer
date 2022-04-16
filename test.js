const Pool = require("pg").Pool;
const connection = {
	connectionString:
		"postgres://aragdgeymsvoyv:796a31af5159c08d800873ea106ec4284d34366774403580a54099748cc30fa9@ec2-34-246-227-219.eu-west-1.compute.amazonaws.com:5432/dd13jdsnl4eu50",
	ssl: {
		rejectUnauthorized: false,
	},
};

const testing = async () => {
	try {
		const pool = new Pool(connection);
		await pool.connect();
		const orders = await pool.query(
			"SELECT * FROM public.orders ORDER BY order_id ASC"
		);
		pool.end();
		console.log(orders);
	} catch (err) {
		console.log(err);
	}
};

testing();
