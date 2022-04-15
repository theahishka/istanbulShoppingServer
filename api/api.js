const express = require("express");
const apiRouter = express.Router();
const ordersRouter = require("./orders");
const boxesRouter = require("./boxes");
const customersRouter = require("./customers");

apiRouter.use("/orders", ordersRouter);
apiRouter.use("/boxes", boxesRouter);
apiRouter.use("/customers", customersRouter);

module.exports = apiRouter;
