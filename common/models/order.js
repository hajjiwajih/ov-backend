'use strict';

module.exports = function (Order) {


    // model validations
    // Order.validatesAbsenceOf('issueDate');
    // Order.validatesAbsenceOf('clientId');
    // Order.validatesAbsenceOf('clientRef');
    // Order.validatesAbsenceOf('validated');
    // Order.validatesAbsenceOf('isRejected');
    // Order.validatesAbsenceOf('validationDate');
    Order.validatesUniquenessOf('orderAuto');
    Order.validatesFormatOf('nbCodes', { with: /^\+?(0|[1-9]\d*)$/, message: { nbCodes: 'is not a number' } })
    // Order.validatesFormatOf('ticketAmount', { with: /^(1000|5000|10000\d*)$/, message: { ticketAmount: 'is not a number' } })
    // Order.validatesInclusionOf('ticketAmount', { in: [400, 1000, 5000, 10000], message: { ticketAmount: 'not in range of [1000,5000,10000]' } });
    // Order.validatesInclusionOf('ticketType', { in: ["RECHARGE MOBILE", "RECHARGE INTERNET"], message: { ticketType: 'not in range of ["RECHARGE MOBILE" ,"RECHARGE INTERNET"]' } });

    var app = require('../../server/server');


    /**
     * Auto increment order ID on creation
     */

    Order.observe('before save', function addOrderId(ctx, next) {
        if (!ctx.isNewInstance) {
            // console.log('id is already set, returning', ctx.data);
            return next();
        }
        app.dataSources.atlasMongo.connector.collection("sequences").findAndModify({ name: 'Order' }, [['_id', 'asc']], { $inc: { value: 1 } }, { new: true }, function (err, rec) {
            if (err) {
                console.err(err);
            } else {
                if (ctx.instance) {
                    // autoID pattern "COM + 4 digits"
                    ctx.instance.orderAuto = "COM" + rec.value.value.toString().padStart(4, "0");
                } else {
                    ctx.data.orderAuto = rec.value.value;
                }
            }
            next();
        });
    });


    /**
     * <Order> Input validation 
     *  only accept default values
     */

    Order.observe('before save', function (ctx, next) {
        app.models.User.findById(ctx.options.accessToken.userId, function (error, mUser) {

            if (ctx.isNewInstance) {
                ctx.instance.issueDate = new Date()
                ctx.instance.validated = false
                ctx.instance.isRejected = false
                ctx.instance.clientId = ctx.options.accessToken.userId
                ctx.instance.clientRef = mUser.autoID
                if (ctx.instance.validationDate) ctx.instance.validationDate = undefined
                next()
            } else
                next()
        });
    });

    /**
       * get last confirmed order for each client passed (instance version).
       *
       * @param {array} clients clients IDs passed, required in array format
       * @param {object} [options]
       * @callback {Function} callback
       * @param {Error} err Error object
       */

    Order.getLastValidatedOrders = function (clients, cb) {
        //verify passwords match
        var orderMapping = [];
        if (clients && clients.length > 0) {
            clients.forEach(client => {

                Order.find({
                    limit: 1,
                    order: 'validationDate DESC',
                    where: { "and": [{ "clientId": client }, { "validated": true }] }
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
                        orderMapping.push({ id: client, order: data[0] })
                        // if all orders fetched
                        if (orderMapping.length == clients.length) cb(null, orderMapping);
                    }
                })
            });

        }
        else {
            cb(null, { 'results': [] })
        }
    };


    Order.remoteMethod(
        'getLastValidatedOrders', {
        description: 'Get last confirmed order for each given client.',

        http: {
            path: '/lastValidatedOrders',
            verb: 'post'
        },
        accepts: [{
            arg: 'clients',
            type: 'array',
            http: {
                source: 'body'
            },
            description: 'Client IDs in array format. ' +
                'See the description of return value for more details.'
        },
        ],
        returns: {
            arg: 'results',
            type: 'array',
            description: 'Related orders to include in the response. ' +
                'Sorted by confirmation date for each given client ID.'
        },
    },
    );


    /**
     * @Desc
     * Apply access rules & disable unnecessary remote routes
     */
    // disable some direct model methods
    Order.disableRemoteMethodByName("patch", true);
    Order.disableRemoteMethodByName("head", true);
    Order.disableRemoteMethodByName("headById", true);
    Order.disableRemoteMethodByName("upsert", true);
    Order.disableRemoteMethodByName("upsert", true);
    Order.disableRemoteMethodByName("updateAll", true);
    Order.disableRemoteMethodByName("replaceOrCreate", true);
    Order.disableRemoteMethodByName("updateAttributes", true);
    Order.disableRemoteMethodByName("upsertWithWhere", true);
    Order.disableRemoteMethodByName("createChangeStream", true);
    Order.disableRemoteMethodByName("findOne", true);
    Order.disableRemoteMethodByName("exists", true);
    // disable some related model methods
    disableAllMethodsBut(Order, []);

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
                relationMethods.push({ name: '__update__' + relation, isStatic: false });
                relationMethods.push({ name: '__destroy__' + relation, isStatic: false });
                relationMethods.push({ name: '__unlink__' + relation, isStatic: false });
                relationMethods.push({ name: '__count__' + relation, isStatic: false });
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
