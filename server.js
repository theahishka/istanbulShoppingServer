const express = require("express");
const app = express();
const PORT = 4000;
const morgan = require("morgan");
const cors = require("cors");
const bodyParser = require("body-parser");
const errorhandler = require("errorhandler");
const apiRouter = require("./api/api");

app.use(cors());
app.use(morgan("dev"));
app.use(express.json());

app.use("/api", apiRouter);

app.use(errorhandler());

app.listen(process.env.PORT || PORT, () => {
	console.log(`Server is listening!`);
});

// module.exports = app;
