require('dotenv').config({ path: __dirname + '/./../.env' });
console.log(new Date(), "production")
//console.log(encodeURIComponent(`${process.env.DB_PASS}`))
module.exports = {

    atlasMongo: {
        "name": "atlasMongo",
        "connector": "mongodb",
         //"host": `${process.env.DB_HOST}`,
         //"port": process.env.DB_PORT,
         //"replicaSet": `${process.env.REPLICAT}`,
         //"database": `oj`,
         //"user": `${process.env.DB_USER}`,
         //"authSource": "admin",
         //"password": `${encodeURIComponent(process.env.DB_PASS)}`,
         //"readPreference": "primary",
        "useNewUrlParser": true,
        "url": `mongodb://${process.env.DB_USER}:${encodeURIComponent(process.env.DB_PASS)}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}?authSource=${process.env.DB_NAME}&replicaSet=${process.env.REPLICAT}&readPreference=primary&w=majority&retryWrites=true`

    },

    ditriot_smtp: {
        "name": "ditriot_smtp",
        "connector": "mail",
        "transports": [
            {
                "type": "smtp",
                "host": `${process.env.SMTP_HOST}`,
                "secure": true,
                "port": `${process.env.SMTP_PORT}`,
                "tls": {
                    "rejectUnauthorized": false
                },
                "auth": {
                    "user": `${process.env.SENDER}`,
                    "pass": `${process.env.PASS}`
                }
            }
        ]
    },


}
