const express = require("express");
const customersRouter = express.Router();
const Pool = require("pg").Client;
const connection = {
	connectionString:
		"postgres://doadmin:AVNS_iIGK-LkQKHLCKig@istanbulshopping-do-user-11377156-0.b.db.ondigitalocean.com:25060/defaultdb",
	ssl: {
		rejectUnauthorized: false,
	},
};

// Get all customers
customersRouter.get("/", async (req, res, next) => {
	try {
		const pool = new Pool(connection);
		await pool.connect();

		const customers = await pool.query(
			"SELECT * FROM customers ORDER BY full_name DESC"
		);

		await pool.end();
		res.status(200).send(customers.rows);
	} catch (err) {
		console.log(err);
	}
});

// Post new customer
customersRouter.post("/", async (req, res, next) => {
	try {
		const pool = new Pool(connection);
		await pool.connect();

		const newCustomer = await pool.query(
			"INSERT INTO customers (full_name, address, phone, comments, date_joined) VALUES ($1, $2, $3, $4, $5) RETURNING *",
			[
				req.body.fullName,
				req.body.address,
				req.body.phone,
				req.body.comments,
				joinedDate,
			]
		);
		const newCustomerId = newCustomer.rows[0].customer_id;

		await pool.query(
			"CREATE TABLE customer_" +
				newCustomerId +
				" (order_id integer NOT NULL, box_id integer NOT NULL, number_of_items integer NOT NULL, total_amount real NOT NULL, outstanding real NOT NULL, customer_id integer NOT NULL, customer_full_name text NOT NULL, pending text NOT NULL, number_of_payments integer, total_revenue real NOT NULL, total_costs real NOT NULL, total_item_cost real NOT NULL, total_delivery_cost real, total_airway_cost real, total_profit real NOT NULL, date_delivered timestamp with time zone, date_created timestamp with time zone NOT NULL)"
		);

		await pool.end();
		res.status(201).send(newCustomerId);
	} catch (err) {
		console.log(err);
	}
});

module.exports = customersRouter;
