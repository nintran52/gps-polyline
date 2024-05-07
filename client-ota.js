const mqtt = require("mqtt");
const fs = require("fs");
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
  ca: fs.readFileSync(process.env.CertPath + "ca.crt"),
  cert: fs.readFileSync(process.env.CertPath + "thing.crt"),
  key: fs.readFileSync(process.env.CertPath + "thing.key"),
};

// Connect to MQTT broker
const client = mqtt.connect(options);

// Event handlers
client.on("connect", () => {
  console.log("Connected to MQTT broker");
  client.subscribe(process.env.OTAServerTopic, { qos: 1 }, function (err) {
    if (!err) {
      console.log("Successfully subscribed with QoS 1");
    }
  });
});

client.on("message", (topic, message) => {
  try {
    // Convert the message from buffer to string and then parse it as JSON
    const jsonData = JSON.parse(message.toString());
    console.log("Received message:", jsonData);
    // Process the JSON data
    handleMessage(jsonData);
  } catch (e) {
    console.error("Error parsing JSON!", e);
  }
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

let fwDeploymentTemplate = {
  msg_type: "RESP",
  key: "update_firmware",
  id: "e10184be-1c2a-4fd4-a06f-4acfb8b9fff0",
  time: "2024-05-04T17:02:15.83461874Z",
  bike_id: "17a7136a-8826-4502-b3e7-7b66afba6865",
  msg: {
    deployment_process_id: "8a039ad2-8002-4121-9026-59388490ec2f",
    fw_deployment_id: "8a039ad2-8002-4121-9026-59388490ec2f",
    states: {
      preparing: {
        status: "waiting",
        errors: [],
      },
      downloading: {
        status: "waiting",
        errors: [],
      },
      installing: {
        status: "waiting",
        errors: [],
      },
    },
  },
};

let statesTemplate = {
  preparing: {
    status: "waiting",
    errors: [],
  },
  downloading: {
    status: "waiting",
    errors: [],
  },
  installing: {
    status: "waiting",
    errors: [],
  },
};

function handleMessage(data) {
  switch (data.key) {
    case "update_firmware":
      // Assuming 'deployment_type' can be 'start' or 'cancel'
      if (data.msg.deployment_type === "cancel") {
        // Add code here to cancel the firmware update
      } else if (data.msg.deployment_type === "confirm") {
        // Add code here to start the firmware update
        publishPreparing(data);
        setTimeout(() => {
          publishDownloading(data);
        }, 4000);
        setTimeout(() => {
          publishInstalling(data);
        }, 14000);
        setTimeout(() => {
          publishDone(data);
        }, 24000);
      }
      break;
    default:
      console.log("Received an unknown command key:", data.key);
  }
}

const publishPreparing = (data) => {
  let preparingStates = { ...statesTemplate };
  preparingStates.preparing.status = "in-progress";
  preparingStates.downloading.status = "waiting";
  preparingStates.installing.status = "waiting";
  publishFwDeploymentMessage(
    data.bike_id,
    data.msg.deployment_process_id,
    data.msg.fw_deployment_id,
    preparingStates
  );
};

const publishDownloading = (data) => {
  let preparingStates = { ...statesTemplate };
  preparingStates.preparing.status = "done";
  preparingStates.downloading.status = "in-progress";
  preparingStates.installing.status = "waiting";
  publishFwDeploymentMessage(
    data.bike_id,
    data.msg.deployment_process_id,
    data.msg.fw_deployment_id,
    preparingStates
  );
};

const publishInstalling = (data) => {
  let preparingStates = { ...statesTemplate };
  preparingStates.preparing.status = "done";
  preparingStates.downloading.status = "done";
  preparingStates.installing.status = "in-progress";
  publishFwDeploymentMessage(
    data.bike_id,
    data.msg.deployment_process_id,
    data.msg.fw_deployment_id,
    preparingStates
  );
};

const publishDone = (data) => {
  let preparingStates = { ...statesTemplate };
  preparingStates.preparing.status = "done";
  preparingStates.downloading.status = "done";
  preparingStates.installing.status = "done";
  publishFwDeploymentMessage(
    data.bike_id,
    data.msg.deployment_process_id,
    data.msg.fw_deployment_id,
    preparingStates
  );
};

const publishFwDeploymentMessage = (
  bikeID,
  deployment_process_id,
  fwDeploymentID,
  states
) => {
  if (client.connected) {
    fwDeploymentTemplate.id = uuidv4();
    fwDeploymentTemplate.time = moment().toISOString();
    fwDeploymentTemplate.bike_id = bikeID;
    fwDeploymentTemplate.msg.deployment_process_id = deployment_process_id;
    fwDeploymentTemplate.msg.fw_deployment_id = fwDeploymentID;
    fwDeploymentTemplate.msg.states = states;

    console.log("FwDeploymentMessage: ", JSON.stringify(fwDeploymentTemplate));
    client.publish(
      process.env.OTAClientTopic,
      JSON.stringify(fwDeploymentTemplate)
    );
  } else {
    console.log("Client not connected");
  }
};
