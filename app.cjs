"use strict";

let cors = require('cors');

// Importing dependencies and setting up http server
const request = require("request"),
  express = require("express"),
  body_parser = require("body-parser"),
  axios = require("axios").default,
  app = express().use(body_parser.json());

console.log("In the file");

app.use(cors());

var port = process.env.PORT || process.env.OPENSHIFT_NODEJS_PORT || 8080,
    ip   = process.env.IP   || process.env.OPENSHIFT_NODEJS_IP || '0.0.0.0';
app.listen(port, ip);
console.log('Server running on http://%s:%s', ip, port);
// app.listen(process.env.PORT || 1337, () => console.log("webhook is listening"));

app.get("/", async(req, res) => {
  console.log("Root endpoint")
  console.log(process.env['name'])
  res.send(`Great stuff, ${process.env['name']} will win this for sure :)`)
})

app.get("/test", async(req, res) => {
  console.log("Test endpoint")
  res.send("India is the best place and I am going to win this for sure")
})
