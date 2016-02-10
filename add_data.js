var cookieParser = require('cookie-parser');
var csurf = require('csurf');
var express = require('express');
var extend = require('xtend');
var forms = require('forms');
var bodyParser = require('body-parser');
var collectFormErrors = require('express-stormpath/lib/helpers').collectFormErrors;

// Declare the schema of our form:

var itemForm = forms.create({
  activity: forms.fields.string({
    required: true
  }),
  location: forms.fields.string({ required: true }),
  time1: forms.fields.string({required: true})

});

// A render function that will render our form and
// provide the values of the fields, as well
// as any situation-specific locals

function renderForm(req,res,locals){
  res.render('add_data', extend({
    title: 'Add an item',
    csrfToken: req.csrfToken(),
    activity: req.user.customData.activity,
    location: req.user.customData.location,
    time1: req.user.customData.time1
  },locals||{}));
}


// Export a function which will create the
// router and return it

module.exports = function profile(){

  var router = express.Router();

  router.use(bodyParser.urlencoded({ extended: true }));

  router.use(cookieParser());

  router.use(csurf({ cookie: true }));


  // Capture all requests, the form library will negotiate
  // between GET and POST requests

  router.all('/', function(req, res) {

    itemForm.handle(req,{
      success: function(form){
        // The form library calls this success method if the
        // form is being POSTED and does not have errors

        // The express-stormpath library will populate req.user,
        // all we have to do is set the properties that we care
        // about and then cal save() on the user object:
        //req.user.customData.item=[];
        req.user.customData.item.push([form.data.activity,form.data.location,form.data.time1,true]);
        //req.user.customData['anotherfield'] = {'json': 'data'};
        //req.user.customData.location = form.data.location;
        //req.user.customData.time1 = form.data.time1;
        req.user.customData.save();
        req.user.save(function(err){
          if(err){
            if(err.developerMessage){
              console.error(err);
            }
            renderForm(req,res,{
              errors: [{
                error: err.userMessage ||
                err.message || String(err)
              }]
            });
          }else{
            renderForm(req,res,{
              saved:true
            });
          }
        });
      },
      error: function(form){
        // The form library calls this method if the form
        // has validation errors.  We will collect the errors
        // and render the form again, showing the errors
        // to the user
        renderForm(req,res,{
          errors: collectFormErrors(form)
        });
      },
      empty: function(){
        // The form library calls this method if the
        // method is GET - thus we just need to render
        // the form
        renderForm(req,res);
      }
    });
  });

  // This is an error handler for this router

  router.use(function (err, req, res, next) {
    // This handler catches errors for this router
    if (err.code === 'EBADCSRFTOKEN'){
      // The csurf library is telling us that it can't
      // find a valid token on the form
      if(req.user){
        // session token is invalid or expired.
        // render the form anyways, but tell them what happened
        renderForm(req,res,{
          errors:[{error:'Your form has expired.  Please try again.'}]
        });
      }else{
        // the user's cookies have been deleted, we dont know
        // their intention is - send them back to the home page
        res.redirect('/');
      }
    }else{
      // Let the parent app handle the error
      return next(err);
    }
  });

  return router;
};

