'use strict';
var loopback = require('loopback');


loopback.Email.send({
    to: "khalil.0927mejri@gmail.com",
    from: "symtelecom@ditriot.tn",
    subject: "mysubject",
    text: "text message",
    html: "html <b>message</b>"
},
    function (err, result) {
        if (err) {
            console.log('Upppss something crash', err);
        }
        console.log(result);
    });