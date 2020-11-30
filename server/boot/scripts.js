require('dotenv').config({ path: __dirname + '/./../.env' });

module.exports = function (app) {

    var Sequence = app.models.sequences;
    var User = app.models.user;

    const clientSeq = "Client"
    const orderSeq = "Order"

    /**
     * Initiate sequences for <User> model on system startup
     */

    Sequence.findOrCreate({ where: { name: clientSeq } }, {
        name: clientSeq
    }, function (err, seq) {
        // if (err) console.log(err);

        /**
         * Initiate sequences for <Order> model on system startup
         */

        Sequence.findOrCreate({ where: { name: orderSeq } }, {
            name: orderSeq
        }, function (err, seq) {
            // if (err) console.log(err);
            createDefaultUsers()
        })
    })

    /**
     * Create admin / maintainer acount on server startup
     */
    function createDefaultUsers() {
        User.findOne({
            where: { or: [{ role: "maintainer" }, { role: "admin" }] }
        }, function (err, oneUser) {
            if (err) console.log(err)
            if (!oneUser) // not created yet
                User.create([
                    { username: '00000001', email: `${process.env.MAINTAINER_EMAIL}`, password: `${process.env.MAINTAINER_PWD}`, fname: 'maintainer', lname: 'maintainer', cin: "00000001" },
                    { username: '00000002', email: `${process.env.ADMIN_EMAIL}`, password: `${process.env.ADMIN_PWD}`, fname: 'admin', lname: 'admin', cin: "00000002", }
                ]
                    , function (err, users) {
                        if (err) console.log(err);
                        User.createUserWithPrivilege(users[0], "maintainer", function (err) {
                            // if (err) console.log(err)
                        })
                        User.createUserWithPrivilege(users[1], "admin", function (err) {
                            // if (err) console.log(err)
                        })

                    });
        })

    }
}