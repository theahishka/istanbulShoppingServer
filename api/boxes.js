const express = require("express");
const boxesRouter = express.Router();
const Pool = require("pg").Pool;
const connection = {
	user: "ocfpdkthksvjzp",
	password: "4f0c065c19a4e0d122caaa407fb2fcd194114e0a90071ff8cd06fb4429489cd6",
	host: "ec2-52-18-116-67.eu-west-1.compute.amazonaws.com",
	port: 5432,
	database: "dbj0hchqk7guvn",
};

// Get all boxes
boxesRouter.get("/", (req, res, next) => {
	const pool = new Pool(connection);
	pool.connect((err) => {
		if (err) {
			return console.log(err);
		}
		pool.query("SELECT * FROM boxes ORDER BY box_id DESC", (err, data) => {
			if (err) {
				return console.log(err);
			}
			res.status(200).send(data.rows);
			pool.end();
		});
	});
});

// Post new box
boxesRouter.post("/", (req, res, next) => {
	let createdDate = new Date(Date.now());
	const pool = new Pool(connection);
	pool.query(
		"INSERT INTO boxes (number_of_orders, airway_cost, pending, date_created) VALUES ($1, $2, $3, $4) RETURNING *",
		[0, 0, "true", createdDate],
		(err, data) => {
			if (err) {
				return console.log(err);
			}
			const newBoxId = data.rows[0].box_id;
			pool.query(
				"CREATE TABLE box_" +
					newBoxId +
					" (order_id integer NOT NULL, box_id integer NOT NULL, number_of_items integer NOT NULL, total_amount real NOT NULL, outstanding real NOT NULL, customer_id integer NOT NULL, customer_full_name text NOT NULL, pending text NOT NULL, number_of_payments integer, total_revenue real NOT NULL, total_costs real NOT NULL, total_item_cost real NOT NULL, total_delivery_cost real, total_airway_cost real, total_profit real NOT NULL, date_delivered timestamp with time zone, date_created timestamp with time zone NOT NULL)",
				(err) => {
					if (err) {
						return console.log(err);
					}
					res.status(201).send(data.rows[0].box_id);
					pool.end();
				}
			);
		}
	);
});

module.exports = boxesRouter;
