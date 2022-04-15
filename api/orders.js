const express = require("express");
const { compileString } = require("sass");
const ordersRouter = express.Router();
const Pool = require("pg").Pool;
const connection = {
	connectionString:
		"postgres://ocfpdkthksvjzp:4f0c065c19a4e0d122caaa407fb2fcd194114e0a90071ff8cd06fb4429489cd6@ec2-52-18-116-67.eu-west-1.compute.amazonaws.com:5432/dbj0hchqk7guvn",
	ssl: {
		rejectUnauthorized: false,
	},
	// user: "ocfpdkthksvjzp",
	// password:
	// 	"4f0c065c19a4e0d122caaa407fb2fcd194114e0a90071ff8cd06fb4429489cd6",
	// host: "ec2-52-18-116-67.eu-west-1.compute.amazonaws.com",
	// port: 5432,
	// database: "dbj0hchqk7guvn",
};

// Verifying the orderId parameter was passed successfully and if such an order exists
ordersRouter.param("orderId", (req, res, next, orderId) => {
	if (!orderId) {
		console.log("Nothing was passed in the orderId parameter");
		return res.status(404).send();
	}
	const pool = new Pool(connection);
	pool.connect((err) => {
		if (err) {
			return console.log(err);
		}
		pool.query(
			"SELECT * FROM orders WHERE order_id = $1",
			[orderId],
			(err, data) => {
				if (err) {
					return console.log(err);
				}
				if (!data) {
					return res.status(404).send("No such order found");
				}
				req.order = data.rows;
				pool.end();
				return next();
			}
		);
	});
});

// testing route
ordersRouter.get("/test", async (req, res, next) => {
	try {
		const pool = new Pool(connection);
		await pool.connect();
		const orders = await pool.query(
			"SELECT * FROM orders ORDER BY order_id ASC"
		);
		res.status(200).send(orders);
		await pool.end();
	} catch (err) {
		console.log(err);
	}
});

// For getting all orders
ordersRouter.get("/", (req, res, next) => {
	let all = {};
	const pool = new Pool(connection);
	pool.connect((err) => {
		if (err) {
			return console.log(err);
		}
		pool.query(
			"SELECT * FROM orders ORDER BY order_id DESC",
			(err, data) => {
				if (err) {
					return console.log(err);
				}
				all.total = data.rowCount;
				all.orders = data.rows;
				pool.query(
					"SELECT COUNT(*) FROM orders WHERE pending = $1",
					["true"],
					(err, data) => {
						if (err) {
							return console.log(err);
						}
						all.pending = Number(data.rows[0].count);
						all.completed = all.total - all.pending;
						pool.query(
							"SELECT COUNT(*) FROM boxes",
							(err, data) => {
								if (err) {
									console.log(err);
								}
								all.boxes = Number(data.rows[0].count);
								res.status(200).send(all);
								pool.end();
							}
						);
					}
				);
			}
		);
	});
});

// For getting detailed information for a single order
ordersRouter.get("/:orderId", (req, res, next) => {
	const orderDetails = {};

	const pool = new Pool(connection);
	pool.connect((err) => {
		if (err) {
			return console.log(err);
		}
		pool.query(
			"SELECT * FROM customers WHERE customer_id = $1",
			[req.order[0].customer_id],
			(err, data) => {
				if (err) {
					return console.log(err);
				}
				orderDetails.customerInfo = data.rows[0];

				pool.query(
					"SELECT * FROM order_payments_" +
						req.params.orderId +
						" ORDER BY payment_id ASC",
					(err, data) => {
						if (err) {
							return console.log(err);
						}
						orderDetails.paymentsInfo = data.rows;

						pool.query(
							"SELECT * FROM order_items_" +
								req.params.orderId +
								" ORDER BY item_id ASC",
							(err, data) => {
								if (err) {
									return console.log(err);
								}
								orderDetails.itemsInfo = data.rows;
								res.status(200).send(orderDetails);
								pool.end();
							}
						);
					}
				);
			}
		);
	});
});

// Posting new order
ordersRouter.post("/", async (req, res, next) => {
	try {
		const customerId = req.body.customerId;
		const boxId = req.body.boxId;
		const items = req.body.items;
		const payments = req.body.payments;
		const customerFullName = req.body.customerFullName;

		const totalAmount = items
			.map((item) => {
				return Number(item.sellingPrice);
			})
			.reduce((prev, cur) => {
				return prev + cur;
			}, 0);

		let totalPaid = 0;
		if (payments.length > 0) {
			totalPaid = payments
				.map((payment) => {
					return Number(payment.amount);
				})
				.reduce((prev, cur) => {
					return prev + cur;
				}, 0);
		}

		const totalItemCost = items
			.map((item) => {
				return Number(item.buyingPrice);
			})
			.reduce((prev, cur) => {
				return prev + cur;
			}, 0);

		const totalDeliveryCost = 2.5;
		const totalAirwayCost = 0;
		const totalCosts = totalItemCost + totalDeliveryCost + totalAirwayCost;
		const totalProfit = totalAmount - totalCosts;

		let createdDate = new Date(Date.now());

		const pool = new Pool(connection);

		await pool.connect();

		const returnedNewOrder = await pool.query(
			"INSERT INTO orders (box_id, number_of_items, total_amount, outstanding, customer_id, customer_full_name, pending, number_of_payments, total_revenue, total_costs, total_item_cost, total_delivery_cost, total_airway_cost, total_profit, date_delivered, date_created) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16) RETURNING *",
			[
				boxId,
				items.length,
				totalAmount,
				totalAmount - totalPaid,
				customerId,
				customerFullName,
				"true",
				payments.length,
				totalAmount,
				totalCosts,
				totalItemCost,
				totalDeliveryCost,
				totalAirwayCost,
				totalProfit,
				null,
				createdDate,
			]
		);
		const orderId = returnedNewOrder.rows[0].order_id;

		await pool.query(
			"INSERT INTO customer_" +
				customerId +
				" (order_id, box_id, number_of_items, total_amount, outstanding, customer_id, customer_full_name, pending, number_of_payments, total_revenue, total_costs, total_item_cost, total_delivery_cost, total_airway_cost, total_profit, date_delivered, date_created) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)",
			[
				orderId,
				boxId,
				items.length,
				totalAmount,
				totalAmount - totalPaid,
				customerId,
				customerFullName,
				"true",
				payments.length,
				totalAmount,
				totalCosts,
				totalItemCost,
				totalDeliveryCost,
				totalAirwayCost,
				totalProfit,
				null,
				createdDate,
			]
		);

		await pool.query(
			"INSERT INTO box_" +
				boxId +
				" (order_id, box_id, number_of_items, total_amount, outstanding, customer_id, customer_full_name, pending, number_of_payments, total_revenue, total_costs, total_item_cost, total_delivery_cost, total_airway_cost, total_profit, date_delivered, date_created) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)",
			[
				orderId,
				boxId,
				items.length,
				totalAmount,
				totalAmount - totalPaid,
				customerId,
				customerFullName,
				"true",
				payments.length,
				totalAmount,
				totalCosts,
				totalItemCost,
				totalDeliveryCost,
				totalAirwayCost,
				totalProfit,
				null,
				createdDate,
			]
		);

		await pool.query(
			"CREATE TABLE order_items_" +
				orderId +
				" (item_id bigserial NOT NULL, brand text NOT NULL, name text NOT NULL, type text NOT NULL, color text, size text, revenue real NOT NULL, item_costs real NOT NULL, item_cost real NOT NULL, item_delivery_cost real NOT NULL, item_airway_cost real, profit real, PRIMARY KEY (item_id))"
		);

		let deliveryCost = totalDeliveryCost / items.length;

		for (let i = 0; i < items.length; i++) {
			let itemCosts = Number(items[i].buyingPrice) + deliveryCost;
			let profit = Number(items[i].sellingPrice) - itemCosts;
			await pool.query(
				"INSERT INTO order_items_" +
					orderId +
					" (brand, name, type, color, size, revenue, item_costs, item_cost, item_delivery_cost, item_airway_cost, profit) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)",
				[
					items[i].brand,
					items[i].name,
					items[i].type,
					items[i].color,
					items[i].size,
					Number(items[i].sellingPrice),
					itemCosts,
					Number(items[i].buyingPrice),
					deliveryCost,
					0,
					profit,
				]
			);
		}

		await pool.query(
			"CREATE TABLE order_payments_" +
				orderId +
				" (payment_id bigserial NOT NULL, amount real NOT NULL, date timestamp with time zone, PRIMARY KEY (payment_id))"
		);

		let date = new Date(Date.now());
		let time = date.toTimeString();

		if (payments.length > 0) {
			for (let i = 0; i < payments.length; i++) {
				await pool.query(
					"INSERT INTO order_payments_" +
						orderId +
						" (amount, date) VALUES ($1, $2)",
					[
						Number(payments[i].amount),
						new Date(`${payments[i].date} ${time}`),
					]
				);
			}
		}
		res.status(201).send(orderId);
		await pool.end();
	} catch (err) {
		console.log(err);
	}
});

// Delete order
ordersRouter.delete("/:orderId", async (req, res, next) => {
	try {
		const orderId = req.params.orderId;
		const customerId = req.order[0].customer_id;
		const boxId = req.order[0].box_id;

		const pool = new Pool(connection);
		await pool.connect();

		await pool.query("DELETE FROM orders WHERE order_id = $1", [orderId]);
		await pool.query(
			"DELETE FROM customer_" + customerId + " WHERE order_id = $1",
			[orderId]
		);
		await pool.query("DELETE FROM box_" + boxId + " WHERE order_id = $1", [
			orderId,
		]);

		await pool.query("DROP TABLE IF EXISTS order_items_" + orderId);
		await pool.query("DROP TABLE IF EXISTS order_payments_" + orderId);

		res.status(204).send();
		await pool.end();
	} catch (err) {
		console.log(err);
	}
});

// Put customer in order
ordersRouter.put("/:orderId/customer", async (req, res, next) => {
	try {
		const orderId = Number(req.order[0].order_id);
		const updatedCustomerId = Number(req.body.updatedCustomerId);
		const oldCustomerId = Number(req.body.oldCustomerId);
		const boxId = Number(req.body.boxId);

		const pool = new Pool(connection);
		await pool.connect();
		const updatedCustomer = await pool.query(
			"SELECT * FROM customers WHERE customer_id = $1",
			[updatedCustomerId]
		);
		const updatedCustomerFullName = updatedCustomer.rows[0].full_name;

		const updatedOrderArray = await pool.query(
			"UPDATE orders SET customer_id = $1, customer_full_name = $2 WHERE order_id = $3 RETURNING *",
			[updatedCustomerId, updatedCustomerFullName, orderId]
		);

		const updatedOrder = updatedOrderArray.rows[0];

		await pool.query(
			"UPDATE box_" +
				boxId +
				" SET customer_id = $1, customer_full_name = $2 WHERE order_id = $3",
			[updatedCustomerId, updatedCustomerFullName, orderId]
		);

		await pool.query(
			"DELETE FROM customer_" + oldCustomerId + " WHERE order_id = $1",
			[orderId]
		);

		await pool.query(
			"INSERT INTO customer_" +
				updatedCustomerId +
				" (order_id, box_id, number_of_items, total_amount, outstanding, customer_id, customer_full_name, pending, number_of_payments, total_revenue, total_costs, total_item_cost, total_delivery_cost, total_airway_cost, total_profit, date_delivered, date_created) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)",
			[
				updatedOrder.order_id,
				updatedOrder.box_id,
				updatedOrder.number_of_items,
				updatedOrder.total_amount,
				updatedOrder.outstanding,
				updatedOrder.customer_id,
				updatedOrder.customer_full_name,
				updatedOrder.pending,
				updatedOrder.number_of_payments,
				updatedOrder.total_revenue,
				updatedOrder.total_costs,
				updatedOrder.total_item_cost,
				updatedOrder.total_delivery_cost,
				updatedOrder.total_airway_cost,
				updatedOrder.total_profit,
				updatedOrder.date_delivered,
				updatedOrder.date_created,
			]
		);

		res.status(200).send(
			"Order has been reallocated to another customer successfully"
		);

		await pool.end();
	} catch (err) {
		console.log(err);
	}
});

// Put box in order
ordersRouter.put("/:orderId/box", async (req, res, next) => {
	try {
		const orderId = Number(req.order[0].order_id);
		const updatedBoxId = Number(req.body.updatedBoxId);
		const oldBoxId = Number(req.body.oldBoxId);
		const customerId = Number(req.body.customerId);

		const pool = new Pool(connection);
		await pool.connect();

		const updatedOrderArray = await pool.query(
			"UPDATE orders SET box_id = $1 WHERE order_id = $2 RETURNING *",
			[updatedBoxId, orderId]
		);
		const updatedOrder = updatedOrderArray.rows[0];

		await pool.query(
			"UPDATE customer_" +
				customerId +
				" SET box_id = $1 WHERE order_id = $2",
			[updatedBoxId, orderId]
		);

		await pool.query(
			"DELETE FROM box_" + oldBoxId + " WHERE order_id = $1",
			[orderId]
		);

		await pool.query(
			"INSERT INTO box_" +
				updatedBoxId +
				" (order_id, box_id, number_of_items, total_amount, outstanding, customer_id, customer_full_name, pending, number_of_payments, total_revenue, total_costs, total_item_cost, total_delivery_cost, total_airway_cost, total_profit, date_delivered, date_created) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)",
			[
				updatedOrder.order_id,
				updatedOrder.box_id,
				updatedOrder.number_of_items,
				updatedOrder.total_amount,
				updatedOrder.outstanding,
				updatedOrder.customer_id,
				updatedOrder.customer_full_name,
				updatedOrder.pending,
				updatedOrder.number_of_payments,
				updatedOrder.total_revenue,
				updatedOrder.total_costs,
				updatedOrder.total_item_cost,
				updatedOrder.total_delivery_cost,
				updatedOrder.total_airway_cost,
				updatedOrder.total_profit,
				updatedOrder.date_delivered,
				updatedOrder.date_created,
			]
		);

		res.status(200).send(
			"Order has been reallocated to another box successfully"
		);

		await pool.end();
	} catch (err) {
		console.log(err);
	}
});

// Put delivery date in order
ordersRouter.put("/:orderId/delivered-date", async (req, res, next) => {
	try {
		const orderId = Number(req.order[0].order_id);
		const customerId = req.body.customerId;
		const boxId = req.body.boxId;
		let updatedDeliveredDate = req.body.updatedDeliveredDate;
		let date = new Date(Date.now());
		let time = date.toTimeString();

		const outstanding = Number(req.body.outstanding);
		let pending = true;

		if (outstanding === 0 && updatedDeliveredDate) {
			pending = false;
		}

		if (!updatedDeliveredDate) {
			updatedDeliveredDate = null;
		}

		if (updatedDeliveredDate) {
			updatedDeliveredDate = new Date(`${updatedDeliveredDate} ${time}`);
		}

		const pool = new Pool(connection);
		await pool.connect();

		await pool.query(
			"UPDATE orders SET date_delivered = $1, pending = $2 WHERE order_id = $3",
			[updatedDeliveredDate, pending, orderId]
		);

		await pool.query(
			"UPDATE customer_" +
				customerId +
				" SET date_delivered = $1, pending = $2 WHERE order_id = $3",
			[updatedDeliveredDate, pending, orderId]
		);

		await pool.query(
			"UPDATE box_" +
				boxId +
				" SET date_delivered = $1, pending = $2 WHERE order_id = $3",
			[updatedDeliveredDate, pending, orderId]
		);

		res.status(200).send("Delivery date has been updated successfully");

		await pool.end();
	} catch (err) {
		console.log(err);
	}
});

// Post new payment
ordersRouter.post("/:orderId/payment", async (req, res, next) => {
	try {
		const orderId = Number(req.params.orderId);
		const customerId = req.order[0].customer_id;
		const boxId = req.order[0].box_id;
		const dateDelivered = req.order[0].date_delivered;
		const amount = Number(req.body.amount);
		const revenue = req.order[0].total_amount;
		let date = new Date(Date.now());

		console.log(amount);
		const pool = new Pool(connection);
		await pool.connect();

		await pool.query(
			"INSERT INTO order_payments_" +
				orderId +
				" (amount, date) VALUES ($1, $2)",
			[amount, date]
		);

		const payments = await pool.query(
			"SELECT * FROM order_payments_" +
				orderId +
				" ORDER BY payment_id ASC"
		);

		const totalPayments = payments.rows
			.map((payment) => {
				return Number(payment.amount);
			})
			.reduce((prev, cur) => {
				return prev + cur;
			}, 0);

		const outstanding = revenue - totalPayments;

		let pending = true;
		if (outstanding === 0 && dateDelivered) {
			pending = false;
		}

		await pool.query(
			"UPDATE orders SET outstanding = $1, pending = $2, number_of_payments = $3 WHERE order_id = $4",
			[outstanding, pending, payments.rows.length, orderId]
		);

		await pool.query(
			"UPDATE customer_" +
				customerId +
				" SET outstanding = $1, pending = $2, number_of_payments = $3 WHERE order_id = $4",
			[outstanding, pending, payments.rows.length, orderId]
		);

		await pool.query(
			"UPDATE box_" +
				boxId +
				" SET outstanding = $1, pending = $2, number_of_payments = $3 WHERE order_id = $4",
			[outstanding, pending, payments.rows.length, orderId]
		);

		res.status(201).send();

		await pool.end();
	} catch (err) {
		console.log(err);
	}
});

// Put payments in order
ordersRouter.put("/:orderId/payments", async (req, res, next) => {
	try {
		const orderId = Number(req.params.orderId);
		const customerId = req.order[0].customer_id;
		const boxId = req.order[0].box_id;
		const dateDelivered = req.order[0].date_delivered;
		const newAmount = Number(req.body.payment.amount);
		const paymentId = Number(req.body.payment.paymentId);
		const revenue = req.order[0].total_amount;
		let date = new Date(Date.now());

		const pool = new Pool(connection);
		await pool.connect();

		await pool.query(
			"UPDATE order_payments_" +
				orderId +
				" SET amount = $1 WHERE payment_id = $2",
			[newAmount, paymentId]
		);

		const payments = await pool.query(
			"SELECT * FROM order_payments_" +
				orderId +
				" ORDER BY payment_id ASC"
		);

		const totalPayments = payments.rows
			.map((payment) => {
				return Number(payment.amount);
			})
			.reduce((prev, cur) => {
				return prev + cur;
			}, 0);

		const outstanding = revenue - totalPayments;
		let pending = true;
		if (outstanding === 0 && dateDelivered) {
			pending = false;
		}

		await pool.query(
			"UPDATE orders SET outstanding = $1, pending = $2 WHERE order_id = $3",
			[outstanding, pending, orderId]
		);

		await pool.query(
			"UPDATE customer_" +
				customerId +
				" SET outstanding = $1, pending = $2 WHERE order_id = $3",
			[outstanding, pending, orderId]
		);

		await pool.query(
			"UPDATE box_" +
				boxId +
				" SET outstanding = $1, pending = $2 WHERE order_id = $3",
			[outstanding, pending, orderId]
		);

		res.status(200).send();
		await pool.end();
	} catch (err) {
		console.log(err);
	}
});

// Delete payment in order
ordersRouter.delete("/:orderId/payment", async (req, res, next) => {
	try {
		const orderId = req.params.orderId;
		const customerId = req.order[0].customer_id;
		const boxId = req.order[0].box_id;
		const dateDelivered = req.order[0].date_delivered;
		const paymentId = Number(req.body.paymentId);
		const revenue = req.order[0].total_amount;
		let date = new Date(Date.now());

		const pool = new Pool(connection);
		await pool.connect();

		const deletingAmount = await pool.query(
			"SELECT amount FROM order_payments_" +
				orderId +
				" WHERE payment_id = $1",
			[paymentId]
		);

		await pool.query(
			"DELETE FROM order_payments_" + orderId + " WHERE payment_id = $1",
			[paymentId]
		);

		const payments = await pool.query(
			"SELECT * FROM order_payments_" + orderId
		);

		const totalPayments = payments.rows
			.map((payment) => {
				return Number(payment.amount);
			})
			.reduce((prev, cur) => {
				return prev + cur;
			}, 0);

		const outstanding = revenue - totalPayments;

		let pending = true;
		if (outstanding === 0 && dateDelivered) {
			pending = false;
		}

		await pool.query(
			"UPDATE orders SET outstanding = $1, pending = $2, number_of_payments = $3 WHERE order_id = $4",
			[outstanding, pending, payments.rows.length, orderId]
		);

		await pool.query(
			"UPDATE customer_" +
				customerId +
				" SET outstanding = $1, pending = $2, number_of_payments = $3 WHERE order_id = $4",
			[outstanding, pending, payments.rows.length, orderId]
		);

		await pool.query(
			"UPDATE box_" +
				boxId +
				" SET outstanding = $1, pending = $2, number_of_payments = $3 WHERE order_id = $4",
			[outstanding, pending, payments.rows.length, orderId]
		);

		res.status(204).send();
		await pool.end();
	} catch (err) {
		console.log(err);
	}
});

// Put total delivery cost in order
ordersRouter.put("/:orderId/total-delivery-cost", async (req, res, next) => {
	try {
		const orderId = req.params.orderId;
		const customerId = req.order[0].customer_id;
		const boxId = req.order[0].box_id;
		const oldTotalProfit = req.order[0].total_profit;
		const newTotalDeliveryCost = Number(req.body.totalDeliveryCost);
		const oldTotalDeliveryCost = Number(req.body.oldTotalDeliveryCost);
		const oldTotalCosts = req.order[0].total_costs;
		const numberOfItems = req.order[0].number_of_items;

		const newTotalCosts =
			oldTotalCosts - oldTotalDeliveryCost + newTotalDeliveryCost;

		const newTotalProfit =
			oldTotalProfit + oldTotalDeliveryCost - newTotalDeliveryCost;

		const pool = new Pool(connection);
		await pool.connect();

		await pool.query(
			"UPDATE orders SET total_delivery_cost = $1, total_costs = $2, total_profit = $3 WHERE order_id = $4",
			[newTotalDeliveryCost, newTotalCosts, newTotalProfit, orderId]
		);

		await pool.query(
			"UPDATE customer_" +
				customerId +
				" SET total_delivery_cost = $1, total_costs = $2, total_profit = $3 WHERE order_id = $4",
			[newTotalDeliveryCost, newTotalCosts, newTotalProfit, orderId]
		);

		await pool.query(
			"UPDATE box_" +
				boxId +
				" SET total_delivery_cost = $1, total_costs = $2, total_profit = $3 WHERE order_id = $4",
			[newTotalDeliveryCost, newTotalCosts, newTotalProfit, orderId]
		);

		const { rows } = await pool.query(
			"SELECT * FROM order_items_" + orderId + " ORDER BY item_id ASC"
		);

		for (let i = 0; i < rows.length; i++) {
			let oldItemDeliveryCost = oldTotalDeliveryCost / numberOfItems;
			let newItemDeliveryCost = newTotalDeliveryCost / numberOfItems;
			let oldItemCosts = rows[i].item_costs;
			let newItemCosts =
				oldItemCosts - oldItemDeliveryCost + newItemDeliveryCost;
			let oldItemProfit = rows[i].profit;
			let newItemProfit =
				oldItemProfit + oldItemDeliveryCost - newItemDeliveryCost;
			await pool.query(
				"UPDATE order_items_" +
					orderId +
					" SET item_delivery_cost = $1, item_costs = $2, profit = $3 WHERE item_id = $4",
				[
					newItemDeliveryCost,
					newItemCosts,
					newItemProfit,
					rows[i].item_id,
				]
			);
		}

		res.status(200).send();

		await pool.end();
	} catch (err) {
		console.log(err);
	}
});

// Post item in order
ordersRouter.post("/:orderId/item", async (req, res, next) => {
	try {
		const orderId = Number(req.params.orderId);
		const customerId = Number(req.order[0].customer_id);
		const boxId = Number(req.order[0].box_id);
		const totalDeliveryCost = req.order[0].total_delivery_cost;
		const totalAirwayCost = req.order[0].total_airway_cost;
		const brand = req.body.newItem.brand;
		const name = req.body.newItem.name;
		const type = req.body.newItem.type;
		const color = req.body.newItem.color;
		const size = req.body.newItem.size;
		const sellingPrice = Number(req.body.newItem.sellingPrice);
		const buyingPrice = Number(req.body.newItem.buyingPrice);

		const dateDelivered = req.order[0].date_delivered;

		const pool = new Pool(connection);
		await pool.connect();

		const oldItems = await pool.query(
			"SELECT * FROM order_items_" + orderId + " ORDER BY item_id ASC"
		);

		const oldNumberOfItems = oldItems.rows.length;
		const newNumberOfItems = oldNumberOfItems + 1;

		const newItemDeliveryCost = totalDeliveryCost / newNumberOfItems;
		const newItemAirwayCost = totalAirwayCost / newNumberOfItems;
		const newItemCosts =
			buyingPrice + newItemDeliveryCost + newItemAirwayCost;
		const newItemProfit = sellingPrice - newItemCosts;

		await pool.query(
			"INSERT INTO order_items_" +
				orderId +
				" (brand, name, type, color, size, revenue, item_costs, item_cost, item_delivery_cost, item_airway_cost, profit) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)",
			[
				brand,
				name,
				type,
				color,
				size,
				sellingPrice,
				newItemCosts,
				buyingPrice,
				newItemDeliveryCost,
				newItemAirwayCost,
				newItemProfit,
			]
		);

		const newItems = await pool.query(
			"SELECT * FROM order_items_" + orderId + " ORDER BY item_id ASC"
		);

		for (let i = 0; i < newNumberOfItems; i++) {
			const newSingleItemCosts =
				newItems.rows[i].item_cost +
				newItemDeliveryCost +
				newItemAirwayCost;
			const newSingleItemProfit =
				newItems.rows[i].revenue - newSingleItemCosts;
			await pool.query(
				"UPDATE order_items_" +
					orderId +
					" SET item_costs = $1, item_delivery_cost = $2, item_airway_cost = $3, profit = $4 WHERE item_id = $5",
				[
					newSingleItemCosts,
					newItemDeliveryCost,
					newItemAirwayCost,
					newSingleItemProfit,
					newItems.rows[i].item_id,
				]
			);
		}

		const updatedItems = await pool.query(
			"SELECT * FROM order_items_" + orderId + " ORDER BY item_id ASC"
		);

		const newTotalRevenue = updatedItems.rows
			.map((item) => {
				return item.revenue;
			})
			.reduce((prev, cur) => {
				return prev + cur;
			}, 0);

		const newTotalCosts = updatedItems.rows
			.map((item) => {
				return item.item_costs;
			})
			.reduce((prev, cur) => {
				return prev + cur;
			}, 0);

		const newTotalItemCost = updatedItems.rows
			.map((item) => {
				return item.item_cost;
			})
			.reduce((prev, cur) => {
				return prev + cur;
			}, 0);

		const newTotalProfit = updatedItems.rows
			.map((item) => {
				return item.profit;
			})
			.reduce((prev, cur) => {
				return prev + cur;
			});

		const payments = await pool.query(
			"SELECT * FROM order_payments_" +
				orderId +
				" ORDER BY payment_id ASC"
		);

		const totalPaid = payments.rows
			.map((payment) => {
				return payment.amount;
			})
			.reduce((prev, cur) => {
				return prev + cur;
			}, 0);

		const newOutstanding = newTotalRevenue - totalPaid;

		let pending = true;
		if (newOutstanding === 0 && dateDelivered) {
			pending = false;
		}

		await pool.query(
			"UPDATE orders SET number_of_items = $1, total_amount = $2, outstanding = $3, pending = $4, total_revenue = $5, total_costs = $6, total_item_cost = $7, total_profit = $8 WHERE order_id = $9",
			[
				newNumberOfItems,
				newTotalRevenue,
				newOutstanding,
				pending,
				newTotalRevenue,
				newTotalCosts,
				newTotalItemCost,
				newTotalProfit,
				orderId,
			]
		);

		await pool.query(
			"UPDATE customer_" +
				customerId +
				" SET number_of_items = $1, total_amount = $2, outstanding = $3, pending = $4, total_revenue = $5, total_costs = $6, total_item_cost = $7, total_profit = $8 WHERE order_id = $9",
			[
				newNumberOfItems,
				newTotalRevenue,
				newOutstanding,
				pending,
				newTotalRevenue,
				newTotalCosts,
				newTotalItemCost,
				newTotalProfit,
				orderId,
			]
		);

		await pool.query(
			"UPDATE box_" +
				boxId +
				" SET number_of_items = $1, total_amount = $2, outstanding = $3, pending = $4, total_revenue = $5, total_costs = $6, total_item_cost = $7, total_profit = $8 WHERE order_id = $9",
			[
				newNumberOfItems,
				newTotalRevenue,
				newOutstanding,
				pending,
				newTotalRevenue,
				newTotalCosts,
				newTotalItemCost,
				newTotalProfit,
				orderId,
			]
		);

		res.status(201).send();
		await pool.end();
	} catch (err) {
		console.log(err);
	}
});

// Put items in order
ordersRouter.put("/:orderId/items", async (req, res, next) => {
	try {
		const orderId = req.params.orderId;
		const itemId = req.body.itemId;
		const column = req.body.column;
		const newInfo = req.body.newInfo;
		const customerId = req.order[0].customer_id;
		const boxId = req.order[0].box_id;
		const dateDelivered = req.order[0].date_delivered;
		const oldRevenue = req.body.oldRevenue;
		const oldItemCost = req.body.oldItemCost;
		const oldItemDeliveryCost = req.body.oldItemDeliveryCost;
		const oldItemAirwayCost = req.body.oldItemAirwayCost;

		const pool = new Pool(connection);
		await pool.connect();

		if (column === "revenue") {
			let newItemCosts =
				oldItemCost + oldItemDeliveryCost + oldItemAirwayCost;
			let newItemProfit = Number(newInfo) - newItemCosts;
			await pool.query(
				"UPDATE order_items_" +
					orderId +
					" SET revenue = $1, profit = $2 WHERE item_id = $3",
				[Number(newInfo), newItemProfit, itemId]
			);

			const items = await pool.query(
				"SELECT * FROM order_items_" + orderId + " ORDER BY item_id ASC"
			);

			const newTotalRevenue = items.rows
				.map((item) => {
					return item.revenue;
				})
				.reduce((prev, cur) => {
					return prev + cur;
				}, 0);

			const payments = await pool.query(
				"SELECT * FROM order_payments_" +
					orderId +
					" ORDER BY payment_id ASC"
			);

			const totalPaid = payments.rows
				.map((payment) => {
					return payment.amount;
				})
				.reduce((prev, cur) => {
					return prev + cur;
				}, 0);

			const oldTotalCosts = req.order[0].total_costs;

			const newTotalProfit = newTotalRevenue - oldTotalCosts;
			const newOutstanding = newTotalRevenue - totalPaid;

			let pending = true;
			if (newOutstanding === 0 && dateDelivered) {
				pending = false;
			}

			await pool.query(
				"UPDATE orders SET total_amount = $1, outstanding = $2, pending = $3, total_revenue = $4, total_profit = $5 WHERE order_id = $6",
				[
					newTotalRevenue,
					newOutstanding,
					pending,
					newTotalRevenue,
					newTotalProfit,
					orderId,
				]
			);

			await pool.query(
				"UPDATE customer_" +
					customerId +
					" SET total_amount = $1, outstanding = $2, pending = $3, total_revenue = $4, total_profit = $5 WHERE order_id = $6",
				[
					newTotalRevenue,
					newOutstanding,
					pending,
					newTotalRevenue,
					newTotalProfit,
					orderId,
				]
			);

			await pool.query(
				"UPDATE box_" +
					boxId +
					" SET total_amount = $1, outstanding = $2, pending = $3, total_revenue = $4, total_profit = $5 WHERE order_id = $6",
				[
					newTotalRevenue,
					newOutstanding,
					pending,
					newTotalRevenue,
					newTotalProfit,
					orderId,
				]
			);

			res.status(200).send();
			return await pool.end();
		}

		if (column === "item_cost") {
			const newItemCosts =
				Number(newInfo) + oldItemDeliveryCost + oldItemAirwayCost;
			const newItemProfit = oldRevenue - newItemCosts;

			await pool.query(
				"UPDATE order_items_" +
					orderId +
					" SET item_costs = $1, item_cost = $2, profit = $3 WHERE item_id = $4",
				[newItemCosts, Number(newInfo), newItemProfit, itemId]
			);

			const items = await pool.query(
				"SELECT * FROM order_items_" + orderId + " ORDER BY item_id ASC"
			);

			const newTotalItemCost = items.rows
				.map((item) => {
					return item.item_cost;
				})
				.reduce((prev, cur) => {
					return prev + cur;
				}, 0);

			const newTotalCosts = items.rows
				.map((item) => {
					return item.item_costs;
				})
				.reduce((prev, cur) => {
					return prev + cur;
				}, 0);

			const newTotalProfit = items.rows
				.map((item) => {
					return item.profit;
				})
				.reduce((prev, cur) => {
					return prev + cur;
				}, 0);

			await pool.query(
				"UPDATE orders SET total_costs = $1, total_item_cost = $2, total_profit = $3 WHERE order_id = $4",
				[newTotalCosts, newTotalItemCost, newTotalProfit, orderId]
			);

			await pool.query(
				"UPDATE customer_" +
					customerId +
					" SET total_costs = $1, total_item_cost = $2, total_profit = $3 WHERE order_id = $4",
				[newTotalCosts, newTotalItemCost, newTotalProfit, orderId]
			);

			await pool.query(
				"UPDATE box_" +
					boxId +
					" SET total_costs = $1, total_item_cost = $2, total_profit = $3 WHERE order_id = $4",
				[newTotalCosts, newTotalItemCost, newTotalProfit, orderId]
			);

			res.status(200).send();
			return await pool.end();
		}

		await pool.query(
			"UPDATE order_items_" +
				orderId +
				" SET " +
				column +
				" = $1 WHERE item_id = $2",
			[newInfo, itemId]
		);

		res.status(200).send();
		return await pool.end();
	} catch (err) {
		console.log(err);
	}
});

ordersRouter.delete("/:orderId/items", async (req, res, next) => {
	try {
		const orderId = req.params.orderId;
		const itemId = req.body.itemId;
		const dateDelivered = req.order[0].date_delivered;
		const customerId = req.order[0].customer_id;
		const boxId = req.order[0].box_id;
		const oldTotalDeliveryCost = req.order[0].total_delivery_cost;
		const oldTotalAirwayCost = req.order[0].total_airway_cost;

		const pool = new Pool(connection);
		await pool.connect();

		await pool.query(
			"DELETE FROM order_items_" + orderId + " WHERE item_id = $1",
			[itemId]
		);

		const items = await pool.query(
			"SELECT * FROM order_items_" + orderId + " ORDER BY item_id ASC"
		);

		const numberOfItems = items.rows.length;
		const newSingleItemDeliveryCost = oldTotalDeliveryCost / numberOfItems;
		const newSingleItemAirwayCost = oldTotalAirwayCost / numberOfItems;

		for (let i = 0; i < numberOfItems; i++) {
			const newSingleItemCosts =
				items.rows[i].item_cost +
				newSingleItemDeliveryCost +
				newSingleItemAirwayCost;
			const newSingleItemProfit =
				items.rows[i].revenue - newSingleItemCosts;
			await pool.query(
				"UPDATE order_items_" +
					orderId +
					" SET item_costs = $1, item_delivery_cost = $2, item_airway_cost = $3, profit = $4 WHERE item_id = $5",
				[
					newSingleItemCosts,
					newSingleItemDeliveryCost,
					newSingleItemAirwayCost,
					newSingleItemProfit,
					items.rows[i].item_id,
				]
			);
		}

		const updatedItems = await pool.query(
			"SELECT * FROM order_items_" + orderId + " ORDER BY item_id ASC"
		);

		const newTotalRevenue = updatedItems.rows
			.map((item) => {
				return item.revenue;
			})
			.reduce((prev, cur) => {
				return prev + cur;
			}, 0);

		const newTotalCosts = updatedItems.rows
			.map((item) => {
				return item.item_costs;
			})
			.reduce((prev, cur) => {
				return prev + cur;
			}, 0);

		const newTotalItemCost = updatedItems.rows
			.map((item) => {
				return item.item_cost;
			})
			.reduce((prev, cur) => {
				return prev + cur;
			}, 0);

		const newTotalProfit = updatedItems.rows
			.map((item) => {
				return item.profit;
			})
			.reduce((prev, cur) => {
				return prev + cur;
			});

		const payments = await pool.query(
			"SELECT * FROM order_payments_" +
				orderId +
				" ORDER BY payment_id ASC"
		);

		const totalPaid = payments.rows
			.map((payment) => {
				return payment.amount;
			})
			.reduce((prev, cur) => {
				return prev + cur;
			}, 0);

		const newOutstanding = newTotalRevenue - totalPaid;

		let pending = true;
		if (newOutstanding === 0 && dateDelivered) {
			pending = false;
		}

		await pool.query(
			"UPDATE orders SET number_of_items = $1, total_amount = $2, outstanding = $3, pending = $4, total_revenue = $5, total_costs = $6, total_item_cost = $7, total_profit = $8 WHERE order_id = $9",
			[
				numberOfItems,
				newTotalRevenue,
				newOutstanding,
				pending,
				newTotalRevenue,
				newTotalCosts,
				newTotalItemCost,
				newTotalProfit,
				orderId,
			]
		);

		await pool.query(
			"UPDATE customer_" +
				customerId +
				" SET number_of_items = $1, total_amount = $2, outstanding = $3, pending = $4, total_revenue = $5, total_costs = $6, total_item_cost = $7, total_profit = $8 WHERE order_id = $9",
			[
				numberOfItems,
				newTotalRevenue,
				newOutstanding,
				pending,
				newTotalRevenue,
				newTotalCosts,
				newTotalItemCost,
				newTotalProfit,
				orderId,
			]
		);

		await pool.query(
			"UPDATE box_" +
				boxId +
				" SET number_of_items = $1, total_amount = $2, outstanding = $3, pending = $4, total_revenue = $5, total_costs = $6, total_item_cost = $7, total_profit = $8 WHERE order_id = $9",
			[
				numberOfItems,
				newTotalRevenue,
				newOutstanding,
				pending,
				newTotalRevenue,
				newTotalCosts,
				newTotalItemCost,
				newTotalProfit,
				orderId,
			]
		);

		res.status(204).send();
		await pool.end();
	} catch (err) {
		console.log(err);
	}
});

module.exports = ordersRouter;
