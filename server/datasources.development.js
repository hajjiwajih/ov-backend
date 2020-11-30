require('dotenv').config({ path: __dirname + '/./../.env' });
console.log(new Date(), "development")
module.exports = {
    atlasMongo: {
        connector: 'mongodb',
        url: process.env.MONGODB_URL_DEV
    }
}