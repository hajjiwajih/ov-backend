'use strict';

require('dotenv').config({ path: __dirname + '/./../.env' });


// create socket instance 
var socket = require('socket.io-client')(process.env.SOCKET_IO_URL);

module.exports = function (Voucher) {

    // model validations
    // Voucher.validatesAbsenceOf('issueDate');
    // Voucher.validatesInclusionOf('ticketAmount', { in: [400, 1000, 5000, 10000], message: { ticketAmount: 'not in range of [1000,5000,10000]' } });
    // Voucher.validatesInclusionOf('ticketType', { in: ["RECHARGE MOBILE", "RECHARGE INTERNET"], message: { ticketType: 'not in range of ["RECHARGE MOBILE" ,"RECHARGE INTERNET"]' } });

    /**
     * @Remote_hook Trigger SocketIO event on save
     */
    Voucher.observe('after save', function (ctx, next) {
        if (ctx.isNewInstance) socket.emit('newVoucher', ctx.instance);
        next();
    });

    /**
     * <Voucher> Input validation 
     *  only accept default values
     */
    Voucher.observe('before save', function (ctx, next) {
        if (ctx.isNewInstance) {
            ctx.instance.issueDate = new Date()
            next()
        } else
            next()
    });

    /**
     * @Desc
     * Apply access rules & disable unnecessary remote routes
     */

    Voucher.disableRemoteMethodByName("patch", true);
    Voucher.disableRemoteMethodByName("head", true);
    Voucher.disableRemoteMethodByName("headById", true);
    Voucher.disableRemoteMethodByName("upsert", true);
    Voucher.disableRemoteMethodByName("upsert", true);
    Voucher.disableRemoteMethodByName("updateAll", true);
    Voucher.disableRemoteMethodByName("replaceOrCreate", true);
    Voucher.disableRemoteMethodByName("updateAttributes", true);
    Voucher.disableRemoteMethodByName("upsertWithWhere", true);
    Voucher.disableRemoteMethodByName("createChangeStream", true);
    Voucher.disableRemoteMethodByName("findOne", true);
    Voucher.disableRemoteMethodByName("exists", true);

    disableAllMethodsBut(Voucher, []);

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
