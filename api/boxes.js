const express = require("express");
const boxesRouter = express.Router();
const Pool = require("pg").Client;
const connection = {
	user: "postgres",
	password: "154816",
	host: "localhost",
	port: 5432,
	database: "istanbul",
};

// Get all boxes
boxesRouter.get("/", async (req, res, next) => {
	try {
		const pool = new Pool(connection);
		await pool.connect();

		const boxes = await pool.query(
			"SELECT * FROM boxes ORDER BY box_id DESC"
		);

		await pool.end();
		res.status(200).send(boxes.rows);
	} catch (err) {
		console.log(err);
	}
});

// Post new box
boxesRouter.post("/", async (req, res, next) => {
	try {
		let createdDate = new Date(Date.now());

		const pool = new Pool(connection);
		await pool.connect();

		const newBox = await pool.query(
			"INSERT INTO boxes (number_of_orders, airway_cost, pending, date_created) VALUES ($1, $2, $3, $4) RETURNING *",
			[0, 0, "true", createdDate]
		);
		const newBoxId = newBox.rows[0].box_id;

		await pool.query(
			"CREATE TABLE box_" +
				newBoxId +
				" (order_id integer NOT NULL, box_id integer NOT NULL, number_of_items integer NOT NULL, total_amount real NOT NULL, outstanding real NOT NULL, customer_id integer NOT NULL, customer_full_name text NOT NULL, pending text NOT NULL, number_of_payments integer, total_revenue real NOT NULL, total_costs real NOT NULL, total_item_cost real NOT NULL, total_delivery_cost real, total_airway_cost real, total_profit real NOT NULL, date_delivered timestamp with time zone, date_created timestamp with time zone NOT NULL)"
		);

		await pool.end();
		res.status(201).send(newBoxId);
	} catch (err) {
		console.log(err);
	}
});

module.exports = boxesRouter;
