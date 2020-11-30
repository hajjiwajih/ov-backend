'use strict';

module.exports = function (Appaccesstoken) {
    const TOKEN_TTL = 1800
    // custom access token TTL
    Appaccesstoken.observe('before save', function updateTokenTTL(ctx, next) {
        if (!ctx.isNewInstance) {
            // console.log('id is already set, returning', ctx.data);
            return next();
        }
        if (ctx.instance) {
            ctx.instance.ttl = TOKEN_TTL;
        } else {
            ctx.data.ttl = TOKEN_TTL;
        }
        next();
    });

};
