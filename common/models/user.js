'use strict';

/**
 * User made custom extending the built-in model
 * For more infos visit the site below
 * @ref https://github.com/strongloop/loopback-example-user-management/blob/master/common/models/user.js#L15
 */


var path = require('path')
require('dotenv').config({ silent: true, path: __dirname + '/./../../.env' });
var ejs = require("ejs");

module.exports = function (User) {

    // password expiry time
    const PWD_EXPIRY_TIME = 1000 * 60 * 60 * 24 * 90 // 90 days
    // password expiry raised error code
    const PWD_EXPIRED_CODE = 402
    // default account email address 
    const senderAddress = `${process.env.SENDER}`;


    // model validation
    User.validatesUniquenessOf('autoID');
    User.validatesUniquenessOf('cin');
    User.validatesFormatOf('cin', { with: /^([0-9]{8})$/, message: { cin: 'cin wrong format' } })
    User.validatesFormatOf('username', { with: /^(([0-9]{8})|([0-9]{7}[A-Z]))$/, message: { username: 'username wrong format ' } })
    // User.validatesAbsenceOf('role');

    // override model relations
    User.settings.relations = {
        accessTokens: {
            "type": "hasMany",
            "model": "AppAccessToken",
            "foreignKey": "userId",
            "options": {
                "disableInclude": true
            }
        }
    }

    // override acls
    User.settings.acls = [
        {
            principalType: 'ROLE',
            principalId: '$everyone',
            permission: 'DENY'
        },
        {
            principalType: 'ROLE', // this is the important bit
            principalId: '$owner',
            permission: 'ALLOW'
        },
        {
            principalId: "$everyone",
            principalType: "ROLE",
            permission: "ALLOW",
            property: "create"
        },
        {
            principalType: "ROLE",
            principalId: "admin",
            permission: "ALLOW",
            property: "deleteById"
        },
        {
            principalType: "ROLE",
            principalId: "$everyone",
            permission: "ALLOW",
            property: "login"
        },
        {
            principalType: "ROLE",
            principalId: "$everyone",
            permission: "ALLOW",
            property: "logout"
        },
        {
            principalType: "ROLE",
            principalId: "$authenticated",
            permission: "ALLOW",
            property: "findById"
        },
        {
            principalType: "ROLE",
            principalId: "$authenticated",
            permission: "ALLOW",
            property: "patchAttributes"
        },
        {
            principalType: "ROLE",
            principalId: "$owner",
            permission: "ALLOW",
            property: "replaceById"
        },
        {
            principalType: "ROLE",
            principalId: "$everyone",
            permission: "ALLOW",
            property: "verify",
            accessType: "EXECUTE"
        },
        {
            principalType: "ROLE",
            principalId: "$everyone",
            permission: "ALLOW",
            property: "confirm"
        },
        {
            principalType: "ROLE",
            principalId: "$authenticated",
            permission: "ALLOW",
            property: "resetPassword",
            accessType: "EXECUTE"
        },
        {
            principalType: "ROLE",
            principalId: "$authenticated",
            permission: "ALLOW",
            property: "changePassword",
            accessType: "EXECUTE"
        },
        {
            accessType: "*",
            principalType: "ROLE",
            principalId: "$authenticated",
            permission: "ALLOW"
        },
        {
            accessType: "EXECUTE",
            principalType: "ROLE",
            principalId: "$authenticated",
            permission: "ALLOW",
            property: "changePassword"
        },
        {
            accessType: "EXECUTE",
            principalType: "ROLE",
            principalId: "$authenticated",
            permission: "ALLOW",
            property: "setPassword"
        },
        {
            accessType: "*",
            principalType: "ROLE",
            principalId: "$unauthenticated",
            permission: "ALLOW",
            property: "requestPasswordReset"
        },
        {
            accessType: "*",
            principalType: "ROLE",
            principalId: "$unauthenticated",
            permission: "ALLOW",
            property: "resetUserPassword"
        },
        {
            accessType: "WRITE",
            principalType: "ROLE",
            principalId: "$authenticated",
            permission: "ALLOW",
            property: "replace"
        },
        {
            accessType: "EXECUTE",
            principalType: "ROLE",
            principalId: "client",
            permission: "DENY",
            property: "find"
        },
        {
            accessType: "EXECUTE",
            principalType: "ROLE",
            principalId: "client",
            permission: "DENY",
            property: "deleteById"
        }
    ]

    // server instance
    var app = require('../../server/server');

    /**
     * auto increment user id
     */
    User.observe('before save', function addUserId(ctx, next) {
        if (!ctx.isNewInstance) {
            return next();
        }
        app.dataSources.atlasMongo.connector.collection("sequences").findAndModify({ name: 'Client' }, [['_id', 'asc']], { $inc: { value: 1 } }, { new: true }, function (err, rec) {
            if (err) {
                console.err(err);
            } else {
                if (ctx.instance) {
                    // pattern for client auto increment ID
                    ctx.instance.autoID = "CL" + rec.value.value.toString().padStart(4, "0");;
                } else {
                    ctx.data.autoID = rec.value.value;
                }
            }
            next();
        });
    });

    /**
     * <User> Input validation 
     *  only accept default values
     */
    User.observe('before save', function (ctx, next) {
        if (ctx.isNewInstance) {
            ctx.instance.role = "client" // default user with <client> role 
            ctx.instance.emailVerified = false
            next()
        } else
            next()
    });



    /**
     * Send an email with instructions to request resetting an existing user's email
     * uses @ejs template rendering engine 
     */

    User.requestEmailChange = function (req, cb) {
        var url = `${process.env.REDIRECT_URL}`;
        User.findOne({ "where": { "email": req.newEmail } }, function (err, inst) {
            if (err) return cb(err);
            if (inst) {

                let error = new Error('Email already exist')
                Object.assign(error, {
                    code: 422,
                    statusCode: 400,
                });
                cb(error)
            } else
                User.findById(req.userId, function (err, mUser) {
                    if (err) return cb(err);
                    // console.log(err)
                    const tokenData = {
                        ttl: 1800,
                        scopes: ['change-email', 'confirm'],
                    };
                    mUser.createAccessToken(tokenData, function (err, token) {
                        var resetHref = `${process.env.PROTOCOL}://${process.env.API_HOST}:${process.env.API_PORT}/api/users/change-email?userId=`
                            + req.userId + '&oldEmail='
                            + req.oldEmail + '&newEmail='
                            + req.newEmail + '&access_token='
                            + token.id + "&redirect=" + url

                        let homeUrl = process.env.APP_HOST + "/login"

                        if (mUser.role == "admin") {
                            homeUrl = process.env.APP_HOST + "/login-admin"
                        }
                        // then send email
                        ejs.renderFile(path.resolve(__dirname, '../../server/views/reset-email.ejs'), { resetHref: resetHref, homeUrl: homeUrl }, function (err, data) {
                            if (err) {
                                console.log(err);
                            } else {

                                var options = {
                                    to: req.newEmail,
                                    from: senderAddress,
                                    subject: 'Notification : Confirmer votre email Orange Voucher',
                                    html: data
                                }

                                User.app.models.Email.send(options, function (err) {
                                    if (err) return cb('> error sending email reset', err);
                                    // console.log('> sending email reset to:', req.newEmail);
                                    return cb(null, 200)
                                });
                            }
                        });
                    });
                });
        })
    };


    /**
     * Reset an existing user's email
     * @param {*} userId Id of the user changing the email
     * @param {string} oldEmail Current email, required in order
     *   to strongly verify the identity of the requesting user
     * @param {string} newEmail The new password to use.
     * @param {string} token required to verify the identity of the requesting user.
     * @param {object} [options]
     * @param {string} redirect address of redirect url.
     * @callback {Function} callback
     * @param {Error} err Error object
     * @promise
     */

    User.changeEmail = function (userId, oldEmail, newEmail, token, redirect, cb) {
        let redirectUrl = redirect || '/'
        User.findById(userId, function (err, mUser) {
            if (err) return cb(err);
            // console.log(err)
            mUser.patchAttributes({ "email": newEmail, "verificationToken": token }, function (err, userInstance) {
                if (err) return cb(err);
                User.confirm(userId, token, redirectUrl, function (err, redirect) {
                    if (err) return cb(err);
                    return cb(null, { "ok": 200 })
                })
            })
        })
    };

    /**
     * Redirect after email reset succeeded
     */
    User.afterRemote('changeEmail', function (ctx, instance, next) {
        if (ctx.args.redirect !== undefined) {
            if (!ctx.res) {
                return next(new Error(g.f('The transport does not support HTTP redirects.')));
            }
            ctx.res.location(ctx.args.redirect);
            ctx.res.status(302);
        }
        next();
    });


    /**
     * verify password strength before registration
     */
    User.beforeRemote('create', function (context, userInstance, next) {
        // console.log(context.req.body.password)

        var res = checkPasswordStrength(context.req.body.password)
        if (res.status) next()
        else {
            let err = new Error('Weak password detected')
            Object.assign(err, {
                code: 'SET PASSWORD FAILED',
                statusCode: 400,
                statusText: res.msg
            });
            return next(err)
        }
    })


    // verify password strength before registration
    User.beforeRemote('changePassword', function (context, userInstance, next) {
        // console.log(context.req.body)

        var res = checkPasswordStrength(context.req.body.newPassword)
        if (res.status) next()

        else {
            if (context.req.body.newPassword == context.req.body.oldPassword) {
                let err = new Error('Unchanged password detected')
                Object.assign(err, {
                    code: 'SET PASSWORD FAILED',
                    statusCode: 400,
                    statusText: "Consider creating new password"
                });
                return next(err)

            }
            else {
                let err = new Error('Weak password detected')
                Object.assign(err, {
                    code: 'SET PASSWORD FAILED',
                    statusCode: 400,
                    statusText: res.msg
                });
                return next(err)

            }
        }
    })

    /**
     * @utility to check password strength
     * @param {string} password current password to check against.
     * @weak password length lower then 7
     * @meduim password must include at least 1 digit + 1 special char
     * @strong password satisfy all from the above

     */

    function checkPasswordStrength(pwd) {
        var number = /([0-9])/;
        var alphabets = /([a-zA-Z])/;
        var special_characters = /([~,!,@,#,$,%,^,&,*,-,_,+,=,?,>,<])/;
        if (pwd.length < 7) {
            return { status: false, msg: "Weak (should be atleast 7 characters.)" }
        } else {
            if (
                pwd.match(number) &&
                pwd.match(alphabets) &&
                pwd.match(special_characters)
            ) {
                return { status: true, msg: "Strong Password" }

            } else {
                return { status: false, msg: "Medium (should include alphabets, numbers and special characters.)" }
            }
        }
    }

    /**
     * Create or find user role
     * Map new user model to its role
     * Send verification email after registration
     */
    User.afterRemote('create', function (context, userInstance, next) {
        console.log('> user.afterRemote triggered');
        console.log(userInstance.role)
        var app = require('../../server/server');

        var Role = app.models.Role;
        var RoleMapping = app.models.RoleMapping;

        //create the admin role
        Role.findOrCreate({ where: { name: userInstance.role } }, {
            name: userInstance.role
        }, function (err, role) {
            if (err) next(err);

            else {
                role.principals.create({
                    principalType: RoleMapping.USER,
                    principalId: userInstance.id
                }, function (err, principal) {

                    if (err) { return next(err); }

                    else {
                        console.log('User assigned RoleID ' + role.id + ' (' + principal.principalType + ')');
                        userInstance.patchAttributes({ pwdChangedAt: new Date() }, function (err, inst) {
                            if (err) next(err)
                            else next()
                        })
                    }
                });
            }
        });
    });

    /**
     * @hidden
     * Create or find user with extra privilege (admin/maintainer/superadmin)
     * Map new user model to its role
     * Send verification email after registration
     */
    User.createUserWithPrivilege = function (userInstance, mRole, next) {
        var app = require('../../server/server');

        var Role = app.models.Role;
        var RoleMapping = app.models.RoleMapping;

        //create the admin role
        Role.findOrCreate({ where: { name: mRole } }, {
            name: mRole
        }, function (err, role) {
            if (err) next(err);

            else {
                role.principals.create({
                    principalType: RoleMapping.USER,
                    principalId: userInstance.id
                }, function (err, principal) {

                    if (err) { return next(err); }

                    else {
                        console.log('User assigned RoleID ' + role.id + ' (' + principal.principalType + ')');
                        userInstance.patchAttributes({ role: mRole, emailVerified: true, pwdChangedAt: new Date() }, function (err, inst) {
                            if (err) next(err)
                            else {
                                next()
                            }
                        })
                    }
                });
            }
        });
    }

    /**
    * Confirm client registration upon creation
    * @param {*} user the user model to verify
    * @param {object} [options]
    * @callback {Function} callback
    * @param {Error} err Error object
    * @promise
    */
    User.verifyAccount = function (user, cb) {

        console.log('> user.verify account triggered');
        console.log(user.uid);
        User.findById(user.uid, function (err, mUser) {
            if (err) cb(err)
            else {
                const tokenData = {
                    ttl: 1800
                };
                mUser.createAccessToken(tokenData, function (err, token) {
                    mUser.patchAttributes({ "emailVerified": true, "verificationToken": token.id }, function (err, userInstance) {
                        if (err) return cb(err);
                        User.confirm(userInstance.id, token.id, "/", function (err, redirect) {
                            if (err) return cb(err);
                            else {
                                let homeUrl = process.env.APP_HOST + "/login"

                                if (mUser.role == "admin") {
                                    homeUrl = process.env.APP_HOST + "/login-admin"
                                }

                                sendVerificationEmail(userInstance.email, homeUrl)
                                return cb(null, { "ok": 200 })
                            }
                        })
                    })
                })
            }
        })
    };


    /**
     * Send verification email upon account confirmation 
     * uses @ejs template rendering engine
     * @param {string} receiver 
     * @param {homeUrl} homeUrl 
     */
    function sendVerificationEmail(receiver, homeUrl) {

        ejs.renderFile(path.resolve(__dirname, '../../server/views/verify-email.ejs'), { homeUrl: homeUrl }, function (err, data) {
            if (err) {
                console.log(err);
            } else {

                var options = {
                    to: receiver,
                    from: senderAddress,
                    subject: 'Confirmation Compte Orange Voucher',
                    html: data
                }

                User.app.models.Email.send(options, function (err) {
                    if (err) return console.log('> error sending password reset email', err);
                    console.log('> sending password reset email to:', receiver);
                });
            }
        });
    }

    /**
     * Check password expiry upon user login
     * force user to change it again after it was expired
     */
    User.afterRemote("login", function (ctx, instance, next) {
        User.findById(instance.userId, function (err, mUser) {
            if (err) next(err)
            else {
                let d = new Date()
                let diff = d.getTime() - Date.parse(mUser.pwdChangedAt)
                if (diff > PWD_EXPIRY_TIME) {
                    const tokenData = {
                        ttl: 1800,
                        scopes: ['reset-password']
                    };
                    mUser.createAccessToken(1800, { scopes: ['reset-password'] }, function (err, token) {
                        console.log(token)
                        let error = new Error("User account not accessible, Password expired")
                        Object.assign(error, {
                            code: PWD_EXPIRED_CODE,
                            statusCode: 400,
                            statusText: error,
                            message: "Password has expired",
                            name: token.id
                        })
                        next(error)
                    })
                }
                else next()
            }
        })
    })


    /**
     * Reject client registration
     * @param {object} request given userId and description after rejection   
     */
    User.rejectAccount = function (request, cb) {

        // console.log('> user.reject account triggered');
        User.findById(request.uid, function (err, mUser) {
            if (err) cb(err)
            else {
                User.deleteById(request.uid, function (err, res) {
                    if (err) cb(err)
                    else {
                        sendRejectionEmail(mUser.email, request.desc)
                        return cb(null, { "ok": 200 })
                    }
                })
            }
        })
    };

    /**
    * Send denial email upon account rejection 
    * uses @ejs template rendering engine
    * @param {string} receiver 
    * @param {homeUrl} homeUrl 
    */

    function sendRejectionEmail(receiver, msg) {

        ejs.renderFile(path.resolve(__dirname, '../../server/views/reject-email.ejs'), { desc: msg }, function (err, data) {
            if (err) {
                console.log(err);
            } else {

                var options = {
                    to: receiver,
                    from: senderAddress,
                    subject: 'Demande refusée par Symtelecom',
                    html: data
                }

                User.app.models.Email.send(options, function (err) {
                    if (err) return console.log('> error sending password reset email', err);
                    console.log('> sending password reset email to:', receiver);
                });
            }
        });
    }



    /**
    * Redirect to home route upon account confirmation 
    */

    User.afterRemote('confirm', function (ctx, inst, next) {
        console.log('> user.afterRemote confirm triggered')
        // console.log(ctx.args.redirect)
        ctx.res.redirect(ctx.args.redirect);
    });


    /**
     * send password reset link when requested
     */
    User.on('resetPasswordRequest', function (info, next) {
        var config = { host: `${process.env.API_HOST}`, port: "4200" }
        var url = `${process.env.RESET_URL}`;
        var html = 'Click <a href="' + url + '?access_token=' +
            info.accessToken.id + '">here</a> to reset your password';


        User.findById(info.accessToken.userId, function (err, mUser) {
            if (err) next(err)
            else if (mUser) {

                let returnUrl = "/login"
                let homeUrl = process.env.APP_HOST + "/login"

                if (mUser.role == "admin") {
                    returnUrl = "/login-admin"
                    homeUrl = process.env.APP_HOST + "/login-admin"
                }

                var resetHref = url + '?access_token=' + info.accessToken.id + "&uid=" + info.accessToken.userId + "&returnUrl=" + returnUrl

                ejs.renderFile(path.resolve(__dirname, '../../server/views/reset.ejs'), { resetHref: resetHref, homeUrl: homeUrl }, function (err, data) {
                    if (err) {
                        console.log(err);
                    } else {

                        var options = {
                            to: info.email,
                            from: senderAddress,
                            subject: 'Notification : Réinitialiser votre mot de passe Orange Voucher',
                            html: data
                        }

                        User.app.models.Email.send(options, function (err) {
                            if (err) return console.log('> error sending password reset email', err);
                            // console.log('> sending password reset email to:', info.email);
                        });
                    }
                });
            }
        })

    });


    /**
     * Append context options after password change
     * Reset password expiry time
     * Send notification email to user's changed password 
     */
    User.afterRemote('changePassword', function (context, user, next) {

        // console.log("changed", context.res.req.accessToken.userId)
        User.findById(context.res.req.accessToken.userId, function (err, mUser) {
            if (err) return next(err);
            // console.log(err)
            mUser.patchAttributes({ pwdChangedAt: new Date() }, function (err, inst) {

                if (err) next(err)

                let homeUrl = process.env.APP_HOST + "/login"

                if (mUser.role == "admin") {
                    homeUrl = process.env.APP_HOST + "/login-admin"
                }

                ejs.renderFile(path.resolve(__dirname, '../../server/views/password-change.ejs'), { homeUrl: homeUrl }, function (err, data) {
                    if (err) {
                        console.log(err);
                    } else {

                        var options = {
                            to: mUser.email,
                            from: senderAddress,
                            subject: 'Notification : Activité sur votre compte Orange Voucher ',
                            html: data
                        }

                        User.app.models.Email.send(options, function (err) {
                            if (err) return console.log('> error sending password reset email', err);
                            console.log('> sending password reset email to:', info.email);
                        });
                    }
                });

            })

        });
        next()
    });

    /**
     * Reset password expiry time upon change succeeded
     */
    User.afterRemote('setPassword', function (context, user, next) {
        User.findById(context.res.req.accessToken.userId, function (err, mUser) {
            mUser.patchAttributes({ pwdChangedAt: new Date() }, function (err, inst) {
                if (err) next(err)
                next()
            })
        })
    });

    /**
     * Reset password expiry time upon change succeeded
     */
    User.afterRemote('changePassword', function (context, user, next) {
        User.findById(context.res.req.accessToken.userId, function (err, mUser) {
            mUser.patchAttributes({ pwdChangedAt: new Date() }, function (err, inst) {
                if (err) next(err)
                next()
            })
        })
    });


    /**
    * Send an email with instructions to reset an existing user's password
    * uses @ejs template rendering engine
    * @param {string} receiver 
    * @param {homeUrl} homeUrl 
    */
    User.requestPasswordReset = function (body, cb) {
        console.log(body.email)
        if (body.email)
            User.resetPassword({
                email: body.email
            }, function (error) {
                if (error) {
                    let err = new Error('Could not proceed with password reset')
                    Object.assign(err, {
                        code: 'RESET PASSWORD FAILED',
                        statusCode: 400,
                        statusText: error
                    });
                    return cb(err);
                }
                return cb(null, 200)
            });
    };


    // show password reset form
    User.resetUserPassword = function (accessToken, cb) {
        if (!accessToken) return cb(401);
        // res.redirect("localhost:4200/password-reset?access_token=" + req.accessToken.id)
        // res.render('password-reset', {
        //   redirectUrl: '/api/users/reset-password?access_token=' +
        //     req.accessToken.id
        // });
    };

    User.remoteMethod(
        'requestPasswordReset', {
        description: 'Request password reset procedure.',
        http: {
            path: '/request-password-reset',
            verb: 'post'
        },
        accepts: {
            arg: 'email',
            type: 'object',
            http: {
                source: 'body'
            },
            description: 'Email of user changing the password.',
        },
        returns: {
            arg: 'result',
            type: 'object',
            description: 'Send back an email containing further instruction',

        }
    }
    );


    User.remoteMethod(
        'changeEmail', {
        description: 'Change user email upon verification. Duplicate emails not permitted',

        http: {
            path: '/change-email',
            verb: 'get'
        },
        accepts: [
            {
                arg: 'userId',
                type: 'string',
                http: {
                    source: 'query'
                },
                description: 'UserId required to verify user.',

            },
            {
                arg: 'oldEmail',
                type: 'string',
                http: {
                    source: 'query'
                },
                description: 'Current user email.',

            },
            {
                arg: 'newEmail',
                type: 'string',
                http: {
                    source: 'query'
                },
                description: 'New user email.',

            },
            {
                arg: 'access_token',
                type: 'string',
                http: {
                    source: 'query'
                },
                description: 'Requried to verify user requesting the email change.',

            },
            {
                arg: 'redirect',
                type: 'string',
                http: {
                    source: 'query'
                },
                description: 'Redirect url after change.',

            }],
        returns: {
            arg: 'result',
            type: 'object',
            description: 'Redirect route with context response.',

        }
    }
    );


    User.remoteMethod(
        'rejectAccount', {
        description: 'Reject account registration.',

        http: {
            path: '/reject-account',
            verb: 'post'
        },
        accepts: {
            arg: 'request',
            type: 'object',
            http: {
                source: 'body'
            },
            description: 'Given userId and description after rejection.',

        },
        returns: {
            arg: 'result',
            type: 'object',
            description: '{ok : 200}.',
        }
    }
    );


    User.remoteMethod(
        'verifyAccount', {
        description: 'Confirm account registration.',
        http: {
            path: '/verify-account',
            verb: 'post'
        },
        accepts: {
            arg: 'user',
            type: 'object',
            http: {
                source: 'body'
            },
            description: 'Given user instance to verify before confirmation.',
        },
        returns: {
            arg: 'result',
            type: 'object',
            description: '{200 : ok}',
        }
    }
    );

    User.remoteMethod(
        'resetUserPassword', {
        description: 'Reset user password (authenticated version).',
        http: {
            path: '/reset-user-password',
            verb: 'get'
        },
        accepts: {
            arg: 'accessToken',
            type: 'string',
            http: {
                source: 'params'
            },
            description: 'Reset token sent via email.',
        },
        returns: {
            arg: 'result',
            type: 'object',
            description: 'Redirect route with context response.',
        }
    }
    );


    User.remoteMethod(
        'requestEmailChange', {
        description: 'Request reset user email (authenticated version).',
        http: {
            path: '/request-email-change',
            verb: 'post'
        },
        accepts: {
            arg: 'req',
            type: 'object',
            http: {
                source: 'body'
            },
            description: 'Given user instance to verify before confirmation.',
        },
        returns: {
            arg: 'result',
            type: 'object',
            description: 'Redirect route with context response.',
        }
    }
    );


    /**
     * @Desc
     * Apply access rules & disable unnecessary remote routes
     */

    User.disableRemoteMethodByName("patch", true);
    User.disableRemoteMethodByName("head", true);
    User.disableRemoteMethodByName("headById", true);
    User.disableRemoteMethodByName("upsert", true);
    User.disableRemoteMethodByName("upsert", true);
    User.disableRemoteMethodByName("updateAll", true);
    User.disableRemoteMethodByName("replaceOrCreate", true);
    User.disableRemoteMethodByName("updateAttributes", false);
    User.disableRemoteMethodByName("upsertWithWhere", true);
    User.disableRemoteMethodByName("createChangeStream", true);
    User.disableRemoteMethodByName("findOne", true);
    User.disableRemoteMethodByName("exists", true);
    disableAllMethodsBut(User, []);

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


