const Pool = require("pg").Pool;
const connection = {
	// user: "ocfpdkthksvjzp",
	// password:
	// 	"4f0c065c19a4e0d122caaa407fb2fcd194114e0a90071ff8cd06fb4429489cd6",
	// host: "ec2-52-18-116-67.eu-west-1.compute.amazonaws.com",
	// port: 5432,
	// database: "dbj0hchqk7guvn",
	connectionString:
		"postgres://ocfpdkthksvjzp:4f0c065c19a4e0d122caaa407fb2fcd194114e0a90071ff8cd06fb4429489cd6@ec2-52-18-116-67.eu-west-1.compute.amazonaws.com:5432/dbj0hchqk7guvn",
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
