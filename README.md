# Must Voucher Web App

## About

- A web application developed for ticket sales management within SIM reseller companies using **Angular 9, Loopback 3, MongoDB**.

## Flow

When observing Orange Voucher capabilities, our elegant application will provide the following set of features.
User Roles :
•	Administrator
•	Customer


User Stories :

	**Customer :**
Every Customer will be able to do :
1.	Login with his login & password.
2.	Ordering
3.	Consult validated orders
4.	Consult refused orders
5.	Consult non-validated orders
6.	Change email address
7.	Change the phone number
8.	Change the password / Reset password
 

	**Administrator :**
Every Administrator will be able to do :
1.	Login with his login & password
2.	View active orders
3.	View refused orders
4.	View non-validated orders
5.	View customers list
6.	Consult the stock received (Stock available, Stock sold, orders)
7.	Accept / refuse an order from the customer
8.	Change email address
9.	Change the phone number
10.	Change the password / Reset password
11.	Accept/Refuse customers requests


## Architecture

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ![Demo architecture](https://trello-attachments.s3.amazonaws.com/5eddf192ecc32c45d5e609f2/1026x531/5d439633f3179f3e829816c259f531da/image.png)

## Dependencies

- [Loopback v3](https://loopback.io/doc/en/lb3): js framework that enables you to create dynamic end-to-end REST APIs with little or no coding.
- [MongoDB Node.JS Driver](https://mongodb.github.io/node-mongodb-native/): The official MongoDB Node.js driver provides both callback-based and Promise-based interaction with MongoDB, allowing applications to take full advantage of the new features in ES6...
- [SMTP Email connector](https://loopback.io/doc/en/lb3/Email-connector.html): The built-in email connectors enables applications to send email.
- [EJS](https://ejs.co/): Embedded Javascript Templating is a templating engine used by Node.js. Template engine helps to create an HTML template with minimal code. Also, it can inject data into HTML template at the client side and produce the final HTML.
- [Axios](https://github.com/axios/axios): Promise based HTTP client for the browser and node.js.
- [Dotenv](https://github.com/motdotla/dotenv): Loads environment variables from .env for nodejs projects.
- [Socket.IO-client](https://www.npmjs.com/package/socket.io-client): A standalone build of socket.io-client is exposed automatically by the socket.io server as /socket.io/socket.io.js.
- [Swagger-ui](https://swagger.io/tools/swagger-ui/): Swagger UI allows anyone — be it your development team or your end consumers — to visualize and interact with the API’s resources without having any of the implementation logic in place.
- [PDFMake](https://pdfmake.github.io/docs/): PDF document generation library for server-side and client-side usage in pure JavaScript.


## Setup (#run-locally)

### 1. Prerequisites

In order to run the `Backend server`, you will need **Node.js** (tested with version 11.xx). This will include **npm**, needed to install dependencies. You will also need the **MongoDB** envirnoment setup for the intended database.

Clone the `OV-Backend` repository locally. In a terminal, run:

```bash
$ git clone https://gitlab.com/ditriot-consulting/orange-voucher/ov-backend.git
```


**Installation**

- Access project orange voucher (backend)
``` $ cd OV-backend ``` 

- upload .env file specific for dev environment (only 1st time) -> upload it in the root directory of the project from here: https://app.box.com/folder/115449293432 

- install backend depends
``` $ npm install ```

- run the backend service
``` $ npm run dev ```

You can now connect to `http://localhost:3500/explorer` to see api explorer swagger interface.

**To deploy your instance on premise / cloud you can refer to this document:** https://app.box.com/file/676122742644.
