const express = require("express");
const customersRouter = express.Router();
const Pool = require("pg").Pool;
const connection = {
	connectionString:
		"postgres://aragdgeymsvoyv:796a31af5159c08d800873ea106ec4284d34366774403580a54099748cc30fa9@ec2-34-246-227-219.eu-west-1.compute.amazonaws.com:5432/dd13jdsnl4eu50",
	ssl: {
		rejectUnauthorized: false,
	},
};

// Get all customers
customersRouter.get("/", (req, res, next) => {
	const pool = new Pool(connection);
	pool.connect((err) => {
		if (err) {
			return console.log(err);
		}
		pool.query(
			"SELECT * FROM customers ORDER BY full_name DESC",
			(err, data) => {
				if (err) {
					return console.log(err);
				}
				res.status(200).send(data.rows);
				pool.end();
			}
		);
	});
});

// Post new customer
customersRouter.post("/", (req, res, next) => {
	let joinedDate = new Date(Date.now());
	const pool = new Pool(connection);
	pool.connect();
	pool.query(
		"INSERT INTO customers (full_name, address, phone, comments, date_joined) VALUES ($1, $2, $3, $4, $5) RETURNING *",
		[
			req.body.fullName,
			req.body.address,
			req.body.phone,
			req.body.comments,
			joinedDate,
		],
		(err, data) => {
			if (err) {
				return console.log(err);
			}
			const newCustomerId = data.rows[0].customer_id;
			pool.query(
				"CREATE TABLE customer_" +
					newCustomerId +
					" (order_id integer NOT NULL, box_id integer NOT NULL, number_of_items integer NOT NULL, total_amount real NOT NULL, outstanding real NOT NULL, customer_id integer NOT NULL, customer_full_name text NOT NULL, pending text NOT NULL, number_of_payments integer, total_revenue real NOT NULL, total_costs real NOT NULL, total_item_cost real NOT NULL, total_delivery_cost real, total_airway_cost real, total_profit real NOT NULL, date_delivered timestamp with time zone, date_created timestamp with time zone NOT NULL)",
				(err) => {
					if (err) {
						return console.log(err);
					}
					res.status(201).send(data.rows[0].customer_id);
					pool.end();
				}
			);
		}
	);
});

module.exports = customersRouter;
