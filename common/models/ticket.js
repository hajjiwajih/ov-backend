'use strict';

require('dotenv').config({ silent: true, path: __dirname + '/./../../.env' });
const path = require("path")

// generate crypto-materials
const crypto = require('crypto');
const algorithm = 'aes-192-cbc';
const password = process.env.AES_PASS;
const salt = process.env.AES_SALT;
const key = crypto.scryptSync(password, salt, 24);

// pdfmake intialization
const PdfPrinter = require('pdfmake');
const styles = require('./pdf-styles')

// Ticket type 
const MOBILE_TICKET_TYPE = "RECHARGE MOBILE"
const INTERNET_TICKET_TYPE = "RECHARGE INTERNET"
const INTERNET_TICKET_AMOUNT = 400

// require filesystem IO
var fs = require('fs');


module.exports = function (Ticket) {

    // validate model 
    // Ticket.validatesInclusionOf('amount', { in: ["1000", "5000", "10000"], message: { ticketAmount: 'not in range of [1000,5000,10000]' } });

    // get the instance of loopback server
    var app = require('../../server/server');

    /**
     * 
     * generate AES key {password => passphrase, salt => salted, 24 => length} 
     * @optional Use the async `crypto.scrypt()` instead.
     * @param {json} data all voucher tickets into json array format 
     * @param {object} options 
     * @callback [function] 
     * @async
     * @promise
     * 
     * */

    Ticket.insertWithTransaction = async function (data, options, cb) {

        // encrypt vouchers
        let encrypted = encryptCodesAES(data);

        const MongoClient = require('mongodb').MongoClient;

        var uri = process.env.MONGODB_URL_DEV;
        if (process.env.NODE_ENV == "production")
            var uri = `mongodb://${process.env.DB_USER}:${encodeURIComponent(process.env.DB_PASS)}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}?authSource=${process.env.DB_NAME}&readPreference=primary&retryWrites=true&replicaSet=${process.env.REPLICAT}`

        const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });
        await client.connect();

        // Step 1: Start a Client Session
        const session = client.startSession();

        // Step 2: Optional. Define options to use for the transaction
        const transactionOptions = {
            readPreference: 'primary',
            readConcern: { level: 'local' },
            writeConcern: { w: 'majority' }
        };

        // Step 3: Use withTransaction to start a transaction, execute the callback, and commit (or abort on error)
        // Note: The callback for withTransaction MUST be async and/or return a Promise.
        try {
            await session.withTransaction(async () => {
                const tickets = client.db(`${process.env.DB_NAME}`).collection('ticket');

                // Important:: You must pass the session to the operations
                // tickets.createIndex({ "serial": 1 }, { unique: true })
                // tickets.ensureIndex("serial", { unique: true })

                const res = await tickets.insertMany(encrypted, { session });
            }, transactionOptions);
        } finally {
            await session.endSession();
            await client.close();
        }
    };

    /**
     * Encrypt code attribute in ticket model
     * @param {json} data json array format of tickets (model) 
     */
    function encryptCodesAES(data) {
        // Use `crypto.randomBytes` to generate a random iv instead of the static iv
        // shown here.
        const iv = Buffer.alloc(16, 0); // Initialization vector.

        let encrypted = ""
        data.map(ticket => {
            const cipher = crypto.createCipheriv(algorithm, key, iv);
            encrypted = cipher.update(ticket.code, 'utf8', 'hex');
            encrypted += cipher.final('hex');
            ticket.code = encrypted

            // insert the correct Ticket Type
            ticket.ticketType = parseInt(ticket.amount) == INTERNET_TICKET_AMOUNT ? INTERNET_TICKET_TYPE : MOBILE_TICKET_TYPE
        });
        return data
    }


    /**
     * 
     * Retreive all order related tickets after decryption
     * @param {string} orderId order instance ID required to fetch related data 
     * @param {object} options 
     * @callback [function] 
     * @promise
     * 
     * */

    Ticket.getOrderTickets = function (orderId, cb) {
        app.models.Order.findById(orderId, function (err, mOrder) {

            if (err) cb(err)

            else if (mOrder) {
                Ticket.find({
                    where: { "orderId": mOrder.idOrder }
                }, function (error, data) {
                    if (error) {
                        // console.log(error, data)
                        let err = new Error('Cannot find records')
                        Object.assign(err, {
                            code: 'QUERY FAILED',
                            statusCode: 400,
                            statusText: error
                        });
                        return cb(err);
                    } else {
                        // perform AES decryption
                        let clear = decryptCodesAES(data)
                        cb(null, clear)
                    }
                })
            } else {
                let err = new Error('Cannot find instance model with _id: ' + orderId)
                Object.assign(err, {
                    code: 'QUERY FAILED',
                    statusCode: 400,
                    statusText: 'Order instance model does not exist'
                });
                cb(err)
            }
        })
    };

    /**
     * 
     * Retreive all order related tickets after decryption
     * @param {string} orderId order instance ID required to fetch related data 
     * @param {object} options 
     * @callback [function] 
     * @promise
     * 
     * */

    Ticket.getOrderTicketsPDF = function (orderId, templateNb, cb) {
        app.models.Order.findById(orderId, function (err, mOrder) {

            if (err) cb(err)

            else if (mOrder) {
                Ticket.find({
                    where: { "orderId": mOrder.idOrder }
                }, function (error, data) {
                    if (error) {
                        // console.log(error, data)
                        let err = new Error('Cannot find records')
                        Object.assign(err, {
                            code: 'QUERY FAILED',
                            statusCode: 400,
                            statusText: error
                        });
                        return cb(err);
                    } else {
                        // perform AES decryption
                        let clear = decryptCodesAES(data)
                        app.models.User.findById(mOrder.clientId, function (err, mUser) {
                            if (err) cb(err)
                            if (mUser)
                                constructPdf(clear, mUser, templateNb, cb)
                        })
                    }
                })
            } else {
                let err = new Error('Cannot find instance model with _id: ' + orderId)
                Object.assign(err, {
                    code: 'QUERY FAILED',
                    statusCode: 400,
                    statusText: 'Order instance model does not exist'
                });
                cb(err)
            }
        })
    };


    /**
    * Decrypt code attribute in ticket model
    * @param {json} data json array format of tickets (model) 
    */

    function decryptCodesAES(data) {
        // Use `crypto.randomBytes` to generate a random iv instead of the static iv
        // shown here.
        const iv = Buffer.alloc(16, 0); // Initialization vector.

        let clear = ""
        data.map(ticket => {
            const decipher = crypto.createDecipheriv(algorithm, key, iv);
            clear = decipher.update(ticket.code, 'hex', 'utf8');
            clear += decipher.final('utf8');
            ticket.code = clear
        });
        return data
    }

    /**
     * Construct PDF file containing well arranged tickets
     * @param {[json]} data 
     * @callback [function]  
     */
    function constructPdf(data, customer, templateNb, cb) {
        var fonts = {
            Roboto: {
                normal: path.join(__dirname, '..', '..', 'server', 'views', '/fonts/Roboto-Regular.ttf'),
                bold: path.join(__dirname, '..', '..', 'server', 'views', '/fonts/Roboto-Medium.ttf'),
                italics: path.join(__dirname, '..', '..', 'server', 'views', '/fonts/Roboto-Italic.ttf'),
                bolditalics: path.join(__dirname, '..', '..', 'server', 'views', '/fonts/Roboto-MediumItalic.ttf')
            }
        };
        const defaultMargin = [12, 30, 0, 30]
        const noMargin = [35, 0, 0, 25]
        var printer = new PdfPrinter(fonts);
        var docDefinition = {
            pageSize: 'A4',
            // [left, top, right, bottom] or [horizontal, vertical] or just a number for equal margins
            pageMargins: templateNb == 1 ? defaultMargin : noMargin,
            // footer: function (currentPage, pageCount) {
            //     return {
            //         margin: 10,
            //         columns: [
            //             {
            //                 fontSize: 9,
            //                 text: [
            //                     {
            //                         text: '--------------------------------------------------------------------------' +
            //                             '\n',
            //                         margin: [0, 20]
            //                     },
            //                     {
            //                         text: '© xyz pvt., ltd. ' + currentPage.toString() + ' of ' + pageCount,
            //                     }
            //                 ],
            //                 alignment: 'center'
            //             }
            //         ]
            //     };

            // }, 
            footer: function (currentPage, pageCount) { return { text: currentPage.toString() + ' / ' + (pageCount - 1), alignment: 'center' } },

            // header: function (currentPage, pageCount, pageSize) {
            //     // you can apply any logic and return any valid pdfmake element

            //     return [
            //         { text: currentPage.toString() + ' / ' + pageCount, alignment: 'center' },
            //         { canvas: [{ type: 'rect', x: 170, y: 32, w: pageSize.width - 170, h: 40 }] }
            //     ]
            // },
            content: arrangeTickets(data, customer),
            styles: templateNb == 1 ? styles.defaultStyle : styles.customStyle,
            defaultStyle: {
                // alignment: 'justify'
            }
        };

        // construct pdf & write stream to fs
        var pdfDoc = printer.createPdfKitDocument(docDefinition);
        // pdfDoc.pipe(fs.createWriteStream('document.pdf'));
        // pdfDoc.end();

        var chunks = [];
        var result;

        pdfDoc.on('data', function (chunk) {
            chunks.push(chunk);
        });
        pdfDoc.on('end', function () {
            result = Buffer.concat(chunks);
            // cb(null, 'data:application/pdf;base64,' + result.toString('base64'));
            cb(null, result);
        });
        pdfDoc.end();

    }

    /**
     * Arrange tickets into table format per page
     * @param {[json]} data 
     */
    function arrangeTickets(data, customer) {
        var assembly = [];
        var body = [];
        var nbRows = 0;
        var row = [];
        const NB_COLUMNS = 5
        const NB_ROWS = 10

        data.forEach((tk, index) => {
            if (row.length >= NB_COLUMNS) { // more than 5 colspan -> push to [new] row
                nbRows++;
                if (nbRows < NB_ROWS) { // 10 rows per page
                    body.push(row) // push one row to body of the page
                    // push to [new] row
                    row = []
                }
                else { // more than 10 rows -> new page

                    body.push(row)
                    assembly.push(addNewPage(body)) // push old page
                    // push to [new] row in [new] page
                    body = []
                    row = []
                    nbRows = 0;

                }
            }
            // push to the row
            // row.push({ text: `${tk.serial}\n${tk.code}\n${tk.expiryDate}\n${tk.amount}`, margin: [5, 7] })

            function formattedDate(d = new Date) {
                return [d.getHours(), d.getMinutes() + 1, d.getSeconds()]
                    .map(n => n < 10 ? `0${n}` : `${n}`).join(':');
            }

            // tk attributes
            let expiryDate = tk.expiryDate.replace(/^(\d{4})(\d{2})(\d{2})$/, '$3/$2/$1');
            let serial = tk.serial;
            let code = tk.code;


            row.push([
                {
                    style: 'tableExample',
                    table: {

                        body: [
                            [{ text: code, style: 'h2', colSpan: 3, alignment: 'center' }, '', ''],
                            [{ text: `Recharger avant: ${expiryDate}`, style: 'h6', colSpan: 3 }, '', ''],
                            [{ text: `N° de serie: ${serial}`, style: 'h6', colSpan: 3 }, '', ''],
                        ]
                    },
                    layout: 'noBorders'
                },
                body.length || row.length ?
                    {
                        text: customer.lname, // ticket signature + page number
                        alignment: 'right', style: 'footer'
                    }
                    :
                    {
                        // text: customer.lname + " \/" + (assembly.length + 1) + "\/", // ticket signature + page number
                        text: customer.lname + " -- " + (assembly.length + 1) + "/" + Math.round(data.length / (NB_COLUMNS * NB_ROWS)) + " --", // ticket signature + page number
                        // text: "|" + (assembly.length + 1) + "|\t\t\t\t\t\t\t\t\t" + customer.lname, // ticket signature + page number
                        alignment: 'right', style: 'footer'
                    },
            ])

        })


        // push last page if not tickets count are not 5 times X

        for (let index = row.length; index < NB_COLUMNS; index++) {

            row.push([
                {
                    style: 'tableExample',
                    table: {

                        body: [
                            [{ text: "XXXXXXX", style: 'h5', colSpan: 2 }, '', { text: "XXXXXXX", style: 'h5' }],
                            [{ text: "XXXXXXXXXXXX", style: 'h2', colSpan: 3, alignment: 'center' }, '', ''],
                            [{ text: `XXXXXXXXXXXX XXXXXXX`, style: 'h6', colSpan: 3 }, '', ''],
                        ]
                    },
                    layout: 'noBorders'
                }
            ])
        }
        body.push(row)
        // add page number at last ticket

        assembly.push(addNewPage(body))

        return assembly; // return pdf content
    }


    /**
     * Construct new page with data table 
     * @param {[json]} data 
     */
    function addNewPage(data) {
        return {
            style: 'tableExample', pageBreak: 'after',

            table: {
                body: data
            },
            layout: 'noBorders'

            // layout: {
            //     hLineWidth: function (i, node) {
            //         return (i === 0 || i === node.table.body.length) ? 0 : 1;
            //     },
            //     vLineWidth: function (i, node) {
            //         return (i === 0 || i === node.table.widths.length) ? 0 : 1;
            //     },
            //     hLineColor: function (i, node) {
            //         return 'black';
            //     },
            //     vLineColor: function (i, node) {
            //         return 'black';
            //     },
            //     hLineStyle: function (i, node) {
            //         if (i === 0 || i === node.table.body.length) {
            //             return null;
            //         }
            //         return { dash: { length: 10, space: 4 } };
            //     },
            //     vLineStyle: function (i, node) {
            //         if (i === 0 || i === node.table.widths.length) {
            //             return null;
            //         }
            //         return { dash: { length: 4 } };
            //     }
            // }
        }
    }


    /**
     * Find & update required tickets to reflect 'belongTo' relation bindings 
     * @param {string} orderId order instance ID required to fetch related data 
     * @param {string} ticketsCount number of tickets required  
     * @param {string} amount amount of ticket per order 
     * @param {object} options 
     * @callback [function] 
     * @promise
     */

    Ticket.updateTickets = function (orderId, ticketsCount, amount, cb) {
        //verify passwords match
        if (orderId && ticketsCount && amount) {

            Ticket.find({
                limit: ticketsCount, where: { "and": [{ "amount": amount }, { "or": [{ "orderId": { "exists": false } }, { "orderId": null }] }] }
            }, function (error, data) {
                if (error) {
                    // console.log(error, data)
                    let err = new Error('Cannot find records')
                    Object.assign(err, {
                        code: 'QUERY FAILED',
                        statusCode: 400,
                        statusText: error
                    });
                    return cb(err);
                } else {
                    const ids = data.map(x => x.serial);
                    // cb(null, ids);

                    // create belongTo relation bindings -> orderId foreign key 
                    Ticket.updateAll({ "serial": { inq: ids } }, { "orderId": orderId }, function (error, info) {
                        if (error) {
                            let err = new Error('Cannot update records')
                            Object.assign(err, {
                                code: 'UPDATE QUERY FAILED',
                                statusCode: 400,
                                statusText: error
                            });
                            return cb(err);
                        }
                        // console.log(info)
                        if (info.count != ticketsCount) {
                            rollback(orderId, ids, cb)
                        } else {

                            cb(null, info);
                        }
                    });
                }
            })
        }
        else {
            cb(null, { 'count': 0 })
        }
    };

    /**
     * Rollback changes made to each ticket after execution failure
     * @param {string} orderId order instance ID
     * @param {array} tickets array of all updated tickets
     * @callback [function]
     */

    function rollback(orderId, tickets, cb) {
        var app = require('../../server/server');
        var Order = app.models.Order;

        Order.deleteById(orderId)
        Ticket.updateAll({ "serial": { inq: tickets } }, { "orderId": null }, function (error, info) {
            if (error) {
                let err = new Error('Cannot update records')
                Object.assign(err, {
                    code: 'UPDATE QUERY FAILED',
                    statusCode: 400,
                    statusText: error
                });
                return cb(err);
            }
            // console.log(info)
            cb(null, { 'count': 0 });
        });
    }



    /**
     * 
     * Retreive ticket information by serial
     * @param {string} serial order instance ID required to fetch related data 
     * @param {object} options 
     * @callback [function] 
     * @promise
     * 
     * */

    Ticket.fetchTicket = function (serial, cb) {
        Ticket.findById(serial, function (err, mTicket) {

            if (err) return cb(err)

            else if (!mTicket) {
                let err = new Error('Cannot find Ticket object')
                Object.assign(err, {
                    code: 'QUERY FAILED',
                    statusCode: 400,
                    statusText: 'Serial number not existed in datastore'
                });
                return cb(err);
            }

            else if (mTicket.orderId) {
                // fetch related order
                app.models.Order.findById(
                    mTicket.orderId
                    , function (error, mOrder) {
                        if (error) {
                            let err = new Error('Cannot find order object')
                            Object.assign(err, {
                                code: 'QUERY FAILED',
                                statusCode: 400,
                                statusText: error
                            });
                            return cb(err);
                        }
                        else {
                            // fetch related customer
                            app.models.User.findById(
                                mOrder.clientId, function (error, mUser) {
                                    if (error) {
                                        // console.log(error, data)
                                        let err = new Error('Cannot find user object')
                                        Object.assign(err, {
                                            code: 'QUERY FAILED',
                                            statusCode: 400,
                                            statusText: error
                                        });
                                        return cb(err);
                                    }
                                    else
                                        cb(null, {
                                            "isSold": true,
                                            "ticketAmount": mTicket.amount,
                                            "ticketIssueDate": mTicket.issueDate,
                                            "ticketExpiryDate": mTicket.expiryDate,
                                            "ticketType": mTicket.ticketType,

                                            "orderRef": mOrder.orderAuto,
                                            "clientRef": mOrder.clientRef,
                                            "orderIssueDate": mOrder.issueDate,
                                            "orderValidationDate": mOrder.validationDate,

                                            "cusotmerID": mUser.username,
                                            "fname": mUser.fname,
                                            "lname": mUser.lname,

                                        })

                                })
                        }
                    })
            } else {
                cb(null, {
                    "isSold": false,
                    "ticketAmount": mTicket.amount,
                    "ticketIssueDate": mTicket.issueDate,
                    "ticketExpiryDate": mTicket.expiryDate,
                    "ticketType": mTicket.ticketType,

                })
            }
        })
    };

    Ticket.remoteMethod(
        'insertWithTransaction', {
        http: {
            path: '/insertWithTransaction',
            verb: 'post'
        },
        description: 'Create a new instance of the model and persist it into the data source with transaction.',
        accessType: 'WRITE',
        accepts: [
            {
                arg: 'data', type: 'object', allowArray: true,
                createOnlyInstance: true,
                description: 'Model instance data in json array format',
                http: { source: 'body' },
            },
            { arg: 'options', type: 'object', http: 'optionsFromRequest' },
        ],
        returns: { arg: 'data', root: true, description: "MongoDB transaction payload" },
    }
    );


    Ticket.remoteMethod(
        'getOrderTickets', {
        http: {
            path: '/orderTickets/:orderId',
            verb: 'get'
        },
        description: 'get instances of the model filtred by order foreign key.',
        accessType: 'READ',
        accepts: [
            {
                arg: 'orderId', type: 'string', http: { source: 'path' },
                description: 'Order id filter EX: { "orderId": "536685c3c563"}',
                required: true
            },
        ],
        returns: { arg: 'data', root: true, description: "Return all retrieved model data" },
    }
    );


    Ticket.remoteMethod(
        'getOrderTicketsPDF', {
        http: {
            path: '/orderTicketsPDF/:orderId/:templateNb',
            verb: 'get'
        },
        description: 'get instances of the model filtred by order foreign key in pdf format.',
        accessType: 'READ',
        accepts: [
            {
                arg: 'orderId', type: 'string', http: { source: 'path' },
                description: 'Order id filter EX: { "orderId": "536685c3c563"}',
                required: true
            },
            {
                arg: 'templateNb', type: 'number', http: { source: 'path' },
                description: 'Printable document template number EX: { "templateNb": 1234}',
            },
        ],
        returns: { arg: 'data', root: true, type: 'file', description: "Return all retrieved model data" },
    }
    );


    Ticket.remoteMethod(
        'updateTickets', {
        description: "Find & update required tickets to reflect 'belongTo' relation bindings ",
        http: {
            path: '/updateTickets',
            verb: 'get'
        },
        accepts: [{
            arg: 'orderId',
            type: 'string',
            http: {
                source: 'query'
            },
            description: "Order instance ID"
        },
        {
            arg: 'ticketsCount',
            type: 'number',
            http: {
                source: 'query'
            },
            description: "Number of tickets required"

        },
        {
            arg: 'amount',
            type: 'string',
            http: {
                source: 'query'
            },
            description: "Amount of ticket per order"
        }
        ],
        returns: {
            arg: 'info',
            type: 'object',
            description: "Count of updated tickets under required order"
        }
    }
    );


    Ticket.remoteMethod(
        'fetchTicket', {
        http: {
            path: '/fetchTicket/:serial',
            verb: 'get'
        },
        description: 'get instance info of the model filtred by serial primary-key.',
        accessType: 'READ',
        accepts: [
            {
                arg: 'serial', type: 'string', http: { source: 'path' },
                description: 'Ticket id filter EX: { "serial": "536685956263563"}',
                required: true
            },
        ],
        returns: { arg: 'data', root: true, description: "Return all related instance information" },
    }
    );


    /**
     * @Desc
     * Apply access rules & disable unnecessary remote routes
     */

    Ticket.validatesUniquenessOf('orderAuto');

    Ticket.disableRemoteMethodByName("create", true);
    Ticket.disableRemoteMethodByName("patch", true);
    Ticket.disableRemoteMethodByName("head", true);
    Ticket.disableRemoteMethodByName("headById", true);
    Ticket.disableRemoteMethodByName("upsert", true);
    Ticket.disableRemoteMethodByName("upsert", true);
    Ticket.disableRemoteMethodByName("updateAll", true);
    Ticket.disableRemoteMethodByName("replaceOrCreate", true);
    Ticket.disableRemoteMethodByName("updateAttributes", true);
    Ticket.disableRemoteMethodByName("upsertWithWhere", true);
    Ticket.disableRemoteMethodByName("createChangeStream", true);

    // Ticket.disableRemoteMethodByName("find", true);
    // Ticket.disableRemoteMethodByName("findById", true);
    Ticket.disableRemoteMethodByName("findOne", true);

    // Ticket.disableRemoteMethodByName("deleteById", true);

    // Ticket.disableRemoteMethodByName("confirm", true);
    // Ticket.disableRemoteMethodByName("count", true);
    Ticket.disableRemoteMethodByName("exists", true);
    // Ticket.disableRemoteMethodByName("resetPassword", true);

    disableAllMethodsBut(Ticket, []);

};

/**
 * @Method
 * Disable all matched remote routes
 */
function disableAllMethodsBut(model, methodsToExpose) {
    if (model && model.sharedClass) {
        methodsToExpose = methodsToExpose || [];

        var modelName = model.sharedClass.name;
        // var methods = model.sharedClass.methods();
        var relationMethods = [];
        var hiddenMethods = [];

        try {
            Object.keys(model.definition.settings.relations).forEach(function (relation) {
                relationMethods.push({ name: '__findById__' + relation, isStatic: false });
                relationMethods.push({ name: '__destroyById__' + relation, isStatic: false });
                relationMethods.push({ name: '__updateById__' + relation, isStatic: false });
                relationMethods.push({ name: '__exists__' + relation, isStatic: false });
                relationMethods.push({ name: '__link__' + relation, isStatic: false });
                relationMethods.push({ name: '__get__' + relation, isStatic: false });
                relationMethods.push({ name: '__create__' + relation, isStatic: false });
                relationMethods.push({ name: '__update__' + relation, isStatic: false });
                relationMethods.push({ name: '__destroy__' + relation, isStatic: false });
                relationMethods.push({ name: '__unlink__' + relation, isStatic: false });
                relationMethods.push({ name: '__count__' + relation, isStatic: false });
                relationMethods.push({ name: '__delete__' + relation, isStatic: false });
            });
        } catch (err) { }

        relationMethods.forEach(function (method) {
            var methodName = method.name;
            if (methodsToExpose.indexOf(methodName) < 0) {
                hiddenMethods.push(methodName);
                model.disableRemoteMethodByName(methodName, method.isStatic);
            }
        });

        if (hiddenMethods.length > 0) {
            console.log('\nRemote mehtods hidden for', modelName, ':', hiddenMethods.join(', '), '\n');
        }
    }

};