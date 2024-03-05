const mqtt = require("mqtt");
const fs = require("fs");
const polyline = require("google-polyline");
const { v4: uuidv4 } = require("uuid");
var moment = require("moment");
require("dotenv").config();

// MQTT broker details
const options = {
  host: process.env.BrokerUrl,
  port: 8883, // MQTT over TLS typically uses port 8883
  clientId: "mqttjs_" + uuidv4(),
  username: process.env.Thing,
  password: process.env.ThingKey,
  protocol: "mqtts", // Specify that MQTT over TLS should be used
  rejectUnauthorized: false, // Set to true if your CA certificate should be validated
  ca: fs.readFileSync("cert/ca.crt"),
  cert: fs.readFileSync("cert/thing.crt"),
  key: fs.readFileSync("cert/thing.key"),
};

// Connect to MQTT broker
const client = mqtt.connect(options);

// Event handlers
client.on("connect", () => {
  console.log("Connected to MQTT broker");

  tripID = uuidv4();
  startTime = moment().toISOString();

  var routes = polyline.decode(
    "gi|FmtmxR{AT}B\gBH_BGgC_@cBcA{AaAuAs@mB_Ax@[r@Q"
  );
  routes.forEach((value, index) => {
    pushMessage(value, index, routes.length - 1);
  });
});

client.on("message", (topic, message) => {
  console.log(`Received message on topic ${topic}: ${message}`);
  // Handle the received message
});
client.on("error", (err) => {
  console.error(`Error: ${err}`);
});
client.on("close", () => {
  console.log("Connection closed");
});
client.on("offline", () => {
  console.log("Client is offline");
});
// Handle SIGINT (Ctrl+C) gracefully
process.on("SIGINT", () => {
  client.end(() => {
    console.log("Disconnected from MQTT broker");
    process.exit();
  });
});

let gpsTemplate = {
  trip_id: "4a5f60e1-37d0-4b0e-8441-65b1f46d4074",
  bike_id: "4a5f60e1-37d0-4b0e-8441-65b1f46d4075",
  lat_deg: 101.24,
  lng_deg: 82.12,
  speed: 30,
  altitude: 5.4,
  accuracy: 1.2,
  timestamp: "2024-02-27T11:14:01.715253Z",
};

let tripTemplate = {
  trip_id: "6b8b5578-e8ff-4186-b043-262921ef710a",
  bike_id: "a7a5e894-0a95-49e2-8398-80335b2665d6",
  distance: 3000,
  battery_usage: 4,
  watt_usage: 6,
  estimated_cost: 1.4,
  estimated_co2: 12,
  start_at: "",
  end_at: "",
};

function pushMessage(item, index, routesLength) {
  if (client.connected) {
    setTimeout(() => {
      gpsTemplate.trip_id = tripID;
      gpsTemplate.bike_id = process.env.BikeID;
      gpsTemplate.timestamp = moment().toISOString();
      gpsTemplate.lat_deg = item[0];
      gpsTemplate.lng_deg = item[1];

      console.log("Location: ", JSON.stringify(gpsTemplate));
      client.publish(process.env.LocationTopic, JSON.stringify(gpsTemplate));
      if (index == routesLength) {
        publishTripMessage(startTime, tripID);
      }
    }, 1000 * index);
  } else {
    console.log("Client not connected");
  }
}

const publishTripMessage = (startTime, tripID) => {
  if (client.connected) {
    tripTemplate.trip_id = tripID;
    tripTemplate.bike_id = process.env.BikeID;
    tripTemplate.start_at = startTime;
    tripTemplate.end_at = moment().toISOString();

    console.log("Trip: ", JSON.stringify(tripTemplate));
    client.publish(process.env.TripTopic, JSON.stringify(tripTemplate));
  } else {
    console.log("Client not connected");
  }
};
