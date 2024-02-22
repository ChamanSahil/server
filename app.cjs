"use strict";

let cors = require('cors');
const token = process.env.WHATSAPP_TOKEN;

const uuid = require('uuid')
const { Client, Environment, ApiError } = require("square");

const client = new Client({
    accessToken: process.env.SQUARE_TOKEN,
    environment: Environment.Sandbox,
});

const knex = require("knex")({
  client: "mysql",
  connection: {
    host: process.env["MYSQL_HOST"],
    user: process.env["MYSQL_USER"],
    password: process.env["MYSQL_PASSWORD"],
    database: process.env["MYSQL_DATABASE"],
  },
});

const AxiosDigestAuth =  require('@mhoc/axios-digest-auth').default;

const digestAuth = new AxiosDigestAuth({
  username: process.env.C2Q_username,
  password: process.env.C2Q_pwd,
})

// Importing dependencies and setting up http server
const request = require("request"),
  express = require("express"),
  body_parser = require("body-parser"),
  axios = require("axios").default,
  app = express().use(body_parser.json());

app.use(cors());

var port = process.env.PORT || process.env.OPENSHIFT_NODEJS_PORT || 8080,
    ip   = process.env.IP   || process.env.OPENSHIFT_NODEJS_IP || '0.0.0.0';
app.listen(port, ip);
console.log('Server running on http://%s:%s', ip, port);

// Utilities function
async function chat2Query(prompt) {
  try {
      const response = await digestAuth.request({
      headers: { 
          Accept: "application/json",
          ContentType: "application/json"
      },
      data: JSON.stringify({
          "cluster_id": "1379661944646227701",
          "database": "tifihub",
          "tables": [
            "e_products"
          ],
          "instruction": prompt + ". (For gender, use m for males, f for females, everyone for everyone). (If no specific gender or age group is mentioned,  then use everyone for that column value) Return all of the 11 cloumns for each row"
      }),
      method: "POST",
      url: "https://data.tidbcloud.com/api/v1beta/app/chat2query-BOoendGj/endpoint/v2/chat2data",
    });

    // old url was: "https://eu-central-1.data.tidbcloud.com/api/v1beta/app/chat2query-BOoendGj/endpoint/chat2data"
      
    if(response.data.data.result.code !== 200 && response.data.data.result.code !== 429) {
      console.log("Error in the prompt. ")
      return "ERROR:No matching results found for the prompt!!"
    }
    else if(response.data.data.result.code === 429) {
      console.log("Max API Calls Reached. ")
      return "ERROR:Max API Calls Reached"
    }
    else {
      console.log(response.data.data.result.row_count)
      if(response.data.data.columns.length < 8) {
        console.log("Check your query again because the returned fields are less than 8")
        return "ERROR:No matching results found for the prompt!!"
      } else {
        console.log("No of rows are: " + response.data.data.result.row_count)
        // console.log(response.data.data)
        if(response.data.data.result.row_count === 0) return "ERROR:No matching results found for the prompt!!"
        return response.data.data.rows
      }
    } 
  } catch(err) {
    console.log("ERROR: " + err)
    return "ERROR:Server error, please try again"
  }
}

function sendMsg(to, msg, preview, type, link = "", pDesc = "") {
  console.log("SEND MESSAGE FUNCTION")
  let data = {
    "messaging_product": "whatsapp",
    "recipient_type": "individual",
    "to": to,
    "type": type,
    "text": {
      "preview_url": preview,
      "body": msg
    }
  };
  
  if(type == "image") {
    delete data.text
    data.image = {}
    data.image.link = link
    data.image.caption = pDesc
  }
  
  data = JSON.stringify(data)

  let config = {
    method: 'post',
    maxBodyLength: Infinity,
    url: 'https://graph.facebook.com/v16.0/115042151544606/messages',
    headers: { 
      'Content-Type': 'application/json', 
      'Authorization': `Bearer ${token}`
    },
    data : data
  };

  axios.request(config)
  .then((response) => {
    // console.log(JSON.stringify(response.data));
  })
  .catch((error) => {
    console.log("Whatsapp error: " + error);
  });
}

async function nudgeUsers(gender, ageGroup, name, link, desc, price, company, stream, image) {
  const users = await knex('e_users').select('*')
  console.log("In the nudge function")
  
  company = company.toUpperCase()
  
  // checking for direct matching of the parameters
  users.forEach(user => {
    if(user["interests"].includes(stream)) {
      
      console.log("Checking for user: " + user["uName"])
      console.log(user["uGender"] + user["uAgeGroup"] + user["nudge"].toString())
      
      // match is found
      if(user["nudge"] && user["uGender"] === gender && user["uAgeGroup"] === ageGroup) {
        sendMsg(user["uPhoneNo"], "", true, "image", image,
                `Hey user, a new product has been added by *${company}* and it falls within your interests.\n\nThe product details are as follows:\n\n`+
                `*Product Name:* ${name}\n`+
                `*Product Description:* ${desc}\n`+
                `*Price:* ${price}\n\n`+
                `*Note:* You can turn off the product addition updates by using the endpoint *nudge/off*`)
        user["nudge"] = false
      }
      else if(user["nudge"] && gender === "everyone" && user["uAgeGroup"] === ageGroup) {
        sendMsg(user["uPhoneNo"], "", true, "image", image,
                `Hey user, a new product has been added by *${company}* and it falls within your interests.\n\nThe product details are as follows:\n\n`+
                `*Product Name:* ${name}\n`+
                `*Product Description:* ${desc}\n`+
                `*Price:* ${price}\n\n`+
                `*Note:* You can turn off the product addition updates by using the endpoint *nudge/off*`)
        user["nudge"] = false
      }
      else if(user["nudge"] && user["uGender"] === gender && ageGroup === "everyone") {
        sendMsg(user["uPhoneNo"], "", true, "image", image,
                `Hey user, a new product has been added by *${company}* and it falls within your interests.\n\nThe product details are as follows:\n\n`+
                `*Product Name:* ${name}\n`+
                `*Product Description:* ${desc}\n`+
                `*Price:* ${price}\n\n`+
                `*Note:* You can turn off the product addition updates by using the endpoint *nudge/off*`)
        user["nudge"] = false
      }
      else if(user["nudge"] && gender === "everyone" && ageGroup === "everyone") {
        sendMsg(user["uPhoneNo"], "", true, "image", image,
                `Hey user, a new product has been added by *${company}* and it falls within your interests.\n\nThe product details are as follows:\n\n`+
                `*Product Name:* ${name}\n`+
                `*Product Description:* ${desc}\n`+
                `*Price:* ${price}\n\n`+
                `*Note:* You can turn off the product addition updates by using the endpoint *nudge/off*`)
        user["nudge"] = false
      }
    
    }
  })
}

app.get("/", async(req, res) => {
  console.log("Basic route requested")
  res.send("Great stuff, will win this")
})

// WhatsApp configuration endpoints
app.get("/webhook", async (req, res) => {
  const verify_token = "VishalVats";

  // Parse params from the webhook verification request
  let mode = req.query["hub.mode"];
  let token = req.query["hub.verify_token"];
  let challenge = req.query["hub.challenge"];
  
  // Check if a token and mode were sent
  if (mode && token) {
    // Check the mode and token sent are correct
    if (mode === "subscribe" && token === verify_token) {
      // Respond with 200 OK and challenge token from the request
      console.log("WEBHOOK_VERIFIED");
      res.status(200).send(challenge);
    } else {
      // Responds with '403 Forbidden' if verify tokens do not match
      res.sendStatus(403);
    }
  } else {
    res.sendStatus(403);
  }
});

// Whatsapp endpoint to handle request coming in as messages
app.post("/webhook", async (req, res) => {
  // Parse the request body from the POST
  let body = req.body;

  // Check the Incoming webhook message
  // console.log("Incoming webhook message is: "+JSON.stringify(req.body, null, 2));

  // info on WhatsApp text message payload
  if (req.body.object) {
    if (
      req.body.entry &&
      req.body.entry[0].changes &&
      req.body.entry[0].changes[0] &&
      req.body.entry[0].changes[0].value.messages &&
      req.body.entry[0].changes[0].value.messages[0]
    ) {
      // extract the phone number from the webhook payload
      let from = req.body.entry[0].changes[0].value.messages[0].from; 
      let msg_body
      // text is only available when a text message has been sent
      if(req.body.entry[0].changes[0].value.messages[0].text) 
      {
        msg_body = req.body.entry[0].changes[0].value.messages[0].text.body
        // sendMsg("917011238307", `${from} sent the message: ${msg_body}`, true, "text")
      }
      else msg_body = req.body.entry[0].changes[0].value.messages[0].image.sha256 + " & caption is: " + req.body.entry[0].changes[0].value.messages[0].image.caption
      
      console.log("MESSAGE IS: "+msg_body)
      console.log("Message id is: " + req.body.entry[0].changes[0].value.messages[0].id)
      console.log("Sent from: " + req.body.entry[0].changes[0].value.messages[0].from)
      
      //step1: find whether the incoming mesg is sent by a valid user phone
      try {
        const users = await knex('e_users').select('*').where({uPhoneNo: from})
        if(!users.length) {
          sendMsg(from, "*It seems that you are not registered on Ennovation platform.*\n\nGet yourself register on the extension and then try the WhatsApp integration",true,"text")
        } 
        else {
          const msg = msg_body.toLowerCase()

          // list companies
          if(msg === "brands") {
            const brands = await knex('e_brands').select('bName')
            let result = "The registered brands are:\n\n"

            brands.forEach((brand, ind) => {
              result += `${ind+1}. *${brand['bName'].toUpperCase()}*\n`
            })

            sendMsg(from, result, true, "text")
          } 
          else if(msg.includes("brands/")) {

            let result = ""

            if(msg.split("/")[1] == "") {
              result = "*OOPS!* It seems that you forgot to add the brand name\n\n*Try this:* brands/adidas"
              sendMsg(from, result, true, "text")
            } else {
              const brands = await knex('e_brands').select('*').where({bName: msg.split("/")[1]})
              console.log(msg.split("/")[1])
              if(!brands.length) {
                result = "Your entered brand name is *invalid*.\n\nTry the *brands* endpoint to list the brands that are currently registered"
                sendMsg(from, result, true, "text")
              } 
              else {
                const products = await knex('e_products').select('*').where({companyName: msg.split("/")[1]})
                if(!products.length) {
                  result = `*${msg.split("/")[1].toUpperCase()} has not yet added any product in their inventory* 😰`
                  sendMsg(from, result, true, "text")
                } else {
                  products.forEach((product) => {
                    result = `*Name:* ${product['pName']}\n`+
                             `*Description:* ${product['pDesc']}\n`+
                             `*Prefered Gender:* ${product['pGender'].toUpperCase()}\n`+
                             `*Prefered Age Group:* ${product['pAgeGroup']}\n`
                    sendMsg(from, "", true, "image", product['pLoc'], result)  
                  })
                }
              }
            }
          }
          else if(msg.includes("about/")) {
            let result = ""
            
            if(msg.split("/")[1] == "") {
              result = "*OOPS!* It seems that you forgot to add the brand name\n\n*Try this:* about/adidas"
              sendMsg(from, result, true, "text")
            }
            else {
              const brands = await knex('e_brands').select('bDetails').where({bName: msg.split("/")[1]})
              if(!brands.length) {
                result = "Your entered brand name is *invalid*.\n\nTry the *brands* endpoint to list the brands that are currently registered"
                sendMsg(from, result, true, "text")
              } 
              else {
                sendMsg(from, `Here is a short note about *${msg.split("/")[1].toUpperCase()}*:\n\n${brands[0]['bDetails']}` , true, "text")
              }
            }
          }
          else if(msg.includes("nudge/")) {
            let result = ""
            
            if(msg.split("/")[1] == "") {
              result = "*OOPS!* You have not mentioned what you want to do with the product intimations updates !\n\nTry *nudge/off* to turn them off or *nudge/on* to resume them"
              sendMsg(from, result, true, "text")
            }
            else {
              if(msg.split("/")[1] !== "on" && msg.split("/")[1] !== "off") {
                result = "*OOPS!* Only off and on keywords can be used with the nudge command !\n\nTry *nudge/off* to turn them off or *nudge/on* to resume them"
                // sendMsg(from, result, true, "text") 
              }
              else {
                const users = await knex('e_users').select('*')
                users.forEach(async(user) => {
                  if(user["uPhoneNo"] == from && msg.split("/")[1] === "off") {
                    console.log(user["nudge"].toString())
                    if(!user["nudge"]) {
                      result = "Your product notifications are already turned OFF"
                      sendMsg(from, result, true, "text")
                    } else  {
                      await knex('e_users').where({uEmail: user["uEmail"], uName: user["uName"]}).update({nudge: false})
                      result = "Your product notifications are turned OFF"
                      sendMsg(from, result, true, "text")
                    }
                  }
                  else if(user["uPhoneNo"] == from && msg.split("/")[1] === "on") {
                    console.log(user["nudge"].toString())
                    if(user["nudge"]) {
                      result = "Your product notifications are already turned ON"
                      sendMsg(from, result, true, "text")
                    } else {
                      await knex('e_users').where({uEmail: user["uEmail"], uName: user["uName"]}).update({nudge: true}) 
                      result = "Your product notifications are turned ON"
                      sendMsg(from, result, true, "text")
                    }
                  }
                }) 
              }
              
            }
            
          }
          else if(msg === "details") {
            const details = await knex('e_users').select('*').where({uPhoneNo: from})
            
            let nudge = ""
            if(details[0]["nudge"]) nudge = "Your product notification updates are turned *ON*"
            else nudge = "Your product notification updates are turned *OFF*"
            
            let result = `Your registered details are as follows:\n\n`+
                         `*Name:* ${details[0]["uName"]}\n`+
                         `*Email:* ${details[0]["uEmail"]}\n`+
                         `*Interests:* ${details[0]["interests"]}\n\n`+
                         `*Login Streak:* ${details[0]["loginStreak"]}\n`+
                         `*Last Login:* ${((details[0]["lastLogin"])+"").split("00:00")[0]}\n\n` +
                         `*Notifications:* ${nudge}\n\n` +
                         `*Achievements (badges):* `

            const achievements = details[0]["achievements"]
            if(achievements == "") {
              result += "🥺 You have not unlocked any of the 2 achievements. So, buckle up and get those unlocked ASAP"
            } else {
              if(achievements.includes("v")) result += "\nCompleted your first verification"
              if(achievements.includes("f")) result += "\nSubmitted your first feedback"
              if(achievements.includes("l")) result += "\nMaintained a login streak of 5 days" 
            }
            sendMsg(from, result, true, "text")
          }
          else {
            let result = "*OOPS!* You have entered a wrong endpoint. Try the following ones:\n\n"+
                         "1. *Brands*:\nList the brands that are registered on the website\n\n"+
                         "2. *Brands/Adidas*:\nShow the various products listed by Adidas on the website. *(Replace Adidas with a valid brand name)*\n\n"+
                         "3. *Details*:\nList your registered details of the extension\n\n"+
                         "4. *About/Adidas*:\nGives a small summry about the brand. *(Replace Adidas with a valid brand name)*\n\n"+
                         "5. *Nudge/off*:\nBy default, the nudge property is enabled, that is, whenever a new product will be added by a brand that fits within your interests, then a message will be dropped to inform you regarding the same.\n\nSo, you can try the endpoint *nudge/off* to turn off the notifications and *nudge/on* to resume the same"
            sendMsg(from, result, true, "text")
          }              
        } 
      } catch(err) {
        console.log("Line 176 error")
      }
    
    }
    res.sendStatus(200);
  } else {
    // Return a '404 Not Found' if event is not from a WhatsApp API
    res.sendStatus(404);
  }
});

//BRANDS ENDPOINT
app.post("/validateEmail", async(req, res) => {
  console.log("Validating the email")
  try{
    if(req.body.email === "") {
      res.send("ERROR:Email can't be empty")
    }
    
    if(!/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/.test(req.body.email)) {
      res.send("ERROR:Provide a valid email address")
        console.log("Invalid email provided")
      return
    }
    
    const emails = await knex('e_brands').select('*').where({bEmail: req.body.email})
    if(!emails.length) {
      // creating a random 6 digit password
      const pwd = Math.floor(Math.random() * (999999 - 100000) + 100000)
      
      let mailConfig = {
        method: 'get',
        maxBodyLength: Infinity,
        url: `https://versatilevats.com/squarehub/server.php?action=sendEmail&email=${req.body.email}&otp=${pwd}`,
        headers: { }
      };

      // sending the email along with the password
      try {  
         await axios.request(mailConfig)
          .then((response) => {
           if(response == 0) {
             res.send("ERROR:Email Failure")
             return
           }
          }) 
      } catch(err) {
        console.log("Email failure")
        res.send(`ERROR:${err}`)
        return
      }

      console.log("Valid email! Sent the verification email")
      res.send(`Can create a new account:${pwd}`)
    } 
    else {
      res.send("ERROR:Email already in use")
    }
  } catch(err) {
    res.send("ERROR: Server error Line 232")
  }
})

app.post("/createBrand", async(req, res) => {
  console.log("Creating the brand (website)")
  try {
    const body = req.body
    
    // validating the request body    
    if(body.bName === "" || body.bEmail === "" || body.bAddress === "" || body.bStream === "") {
      console.log("Error in creating the brand")
      res.send("ERROR:Provide all required parameters")
      return
    }
    
    if(!/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/.test(body.bEmail)) {
      res.send("ERROR:Provide a valid email address")
      return
    }
    
    if(body.bAddress.length > 50) {
      res.send("ERROR:Address should be of less than 50 characters")
      return
    }
    
    await knex('e_brands').insert({
      bName       : body.bName.toLowerCase(),
      bEmail      : body.bEmail,
      bAddress    : body.bAddress,
      bStream     : body.bStream,
      pwd         : "",
      bDetails    : body.bDetails,
      bDomains    : "",
      bExtraDomain: ""
    })
    
    res.send("SUCCESS! Created the brand")
    res.send(body.bName)
  } catch(err) {
    res.send("ERROR:Server error Line 268")
  }
})

app.post("/login", async(req, res) => {
  console.log("A brand is trying to login")
  const body = req.body
  
  try {
    const users = await knex('e_brands').select('*').where({bEmail: body.email, pwd: body.pwd})
    // no user exists with the given email-pwd pair
    if(!users.length) {
      // sendMsg("917011238307", `${body.email} can't log into the website`, true, "text")
     console.log("Wrong login credentials used (brands)")
      res.send("ERROR:Invalid credentials")
    } else {
      // sendMsg("917011238307", `${body.email} successfully logged into the website`, true, "text")
      console.log("SUCCESS! Brand logged into the website")
      res.send(users[0]["bName"])
    } 
  } catch(err) {
    console.log("Line 286 ERROR")
  }
})

app.post("/addProduct", async(req, res) => {
  console.log("Brand is trying to add a product")
  const body = req.body
  
  if(body.pName.length > 20) {
    res.send("ERROR:Name should be less than 20 characters")
    return 
  }
  
  if(body.pDesc.length > 20) {
    res.send("ERROR:Description should be less than 20 characters")
    return 
  }
  
  try {
    const pCategory = await knex('e_brands').select('bStream').select('bName').where({bEmail: body.bEmail})
    await knex('e_products').insert({
      pName      : body.pName,
      bEmail     : body.bEmail,
      pLink      : "",
      pDesc      : body.pDesc,
      pGender    : body.pGender,
      pAgeGroup  : body.pAgeGroup,
      pLoc       : body.pLoc,
      pPrice     : body.pPrice,
      pCategory  : pCategory[0]["bStream"],
      companyName: pCategory[0]["bName"],
      pickup     : body.pickup,
      label      : body.label
    }) 
    
    console.log(`PICKUP IS: ` + body.pickup)
    console.log(body.pickup)

    console.log("SUCCESS! Product is added and the concerned users have been nudged")
    // have to nudge the user if they have not turned off the property
    nudgeUsers(body.pGender, body.pAgeGroup, body.pName, body.pLink, body.pDesc, body.pPrice, pCategory[0]["bName"], pCategory[0]["bStream"], body.pLoc)
    res.send("Success")
  } catch(err) {
    console.log("ERROR at line 306")
    res.send("ERROR")
  }
})

app.post("/fetchProducts", async(req, res) => {
  console.log("Brands fetched their product inventory")
  const body = req.body
  
  try {
    const products = await knex('e_products').select('*').where({bEmail: body.email})
    if(!products.length) {
      res.send("ERROR:No products")
    } else {
      res.send(products)
    } 
  } catch(err) {
    console.log("ERROR at line 334")
  }
})

app.post("/deleteProduct", async (req, res) => {
  console.log("Brand has reqeusted for PRODUCT DELETION !")
  const body = req.body
  
  const del = await knex('e_products').where({pName: body.pName, bEmail: body.bEmail, pLoc: body.pLoc}).del()
  if(del) res.send("Deleted")
  else res.send("ERROR:Invalid details")
})

app.post("/chat2Query", async(req, res) => {
  const body = req.body
  console.log("Prompt is: " + body.prompt)

  console.log("digestAuth is:")
  console.log(digestAuth);
  
  const response = await chat2Query(body.prompt)
  res.send(response) 
})

// USER ENDPOINTS
app.post("/validateUser", async(req, res) => {
  const body = req.body
  // sendMsg("917011238307", `Someone clicked on the GET OTP button\n\n*Email:* ${body.email}\n\n*Phone:* ${body.phone}`, true, "text")
  
  if(body.email === "" || body.phone === "") {
    res.send("ERROR:Phone/email can't be empty")
    return
  }
  
  if(!/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/.test(body.email)) {
    res.send("ERROR:Provide a valid email address")
    return
  }
  
  try {
    const email = await knex('e_users').select('*').where({uEmail: body.email})
    if(!email.length) {
      const phone = await knex('e_users').select('*').where({uPhoneNo: body.phone})
      if(!phone.length) {

        // if request is for signing up
        if(body.signup) {
          const emailPwd = Math.floor(Math.random() * (999 - 100) + 100)    
          const smsPwd = Math.floor(Math.random() * (999 - 100) + 100) 

          let mailConfig = {
            method: 'get',
            maxBodyLength: Infinity,
            url: `https://versatilevats.com/squarehub/server.php?action=sendEmail&email=${body.email}&otp=${emailPwd}`,
            headers: { }
          };

          let smsConfig = {
            method: 'get',
            maxBodyLength: Infinity,
            url: `https://versatilevats.com/squarehub/server.php?action=sendSMS&phone=${body.phone}&otp=${smsPwd}`,
            headers: { }
          };

          try {
            await axios.request(smsConfig)
              .then((response) => {
                console.log("Signup sms sent");
                res.send(smsPwd + "" + emailPwd)
              })  

            await axios.request(mailConfig)
            .then((response) => {
              console.log("Sign up email sent")
            }) 
          } catch(err) {
            console.log("Wrong Country Code Entered")
            res.send("ERROR:Wrong country code/incorrect number")
          }

        }
        else res.send("SUCCESS")

      } else {
        res.send("ERROR:Phone no is already in use")
      }
    } else {
      res.send("ERROR:Email is already in use")
    } 
  } catch(err) {
    console.log("ERROR at line 364")
  }
})

app.post("/loginUser", async(req, res) => {
  const body = req.body
  // sendMsg("917011238307", `Someone logged in\n\n*Email:* ${body.email}`, true, "text")
  
  try {
    const user = await knex('e_users').select('*').where({uEmail: body.email, uPwd: body.pwd})
    if(!user.length) {
      res.send("ERROR:Invalid credentials")
    } 
    else {
      let lastLogin = new Date(user[0]["lastLogin"])
      let d = new Date()
      const currDate = `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`
      d = `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`
      d = new Date(d)

      let diff = d.getTime() - lastLogin.getTime();
      let difference = diff / (1000 * 60 * 60 * 24);

      let streak = user[0]["loginStreak"]
      const achievements = await knex('e_users').select('achievements').where({uEmail: body.email, uPwd: body.pwd})
      
      if(difference == 1) {
        // increase the login streak
        if(!user[0]["achievements"].includes("l")) await knex('e_users').where({uEmail: body.email, uPwd: body.pwd}).update({loginStreak: Number(user[0]["loginStreak"])+1, achievements: user[0]["achievements"]+"l"})
        else await knex('e_users').where({uEmail: body.email, uPwd: body.pwd}).update({loginStreak: Number(user[0]["loginStreak"])+1})
        streak++
      } else if(difference > 1) {
        await knex('e_users').where({uEmail: body.email, uPwd: body.pwd}).update({loginStreak: 0})
        streak = 0;
      }
      
      console.log("Current date is " + currDate)
      await knex('e_users').where({uEmail: body.email, uPwd: body.pwd}).update({lastLogin: currDate})

      if(achievements[0]["achievements"].includes("l")) {
        res.send(user[0]["uName"]+":"+user[0]["uPoints"] + ":" + streak + ":" + "old" + ":" + user[0]["tag"] + ":" + user[0]["tagAmount"] + ":" + user[0]["orderID"])
      } else {
        res.send(user[0]["uName"]+":"+user[0]["uPoints"] + ":" + streak + ":" + "" + user[0]["tag"] + ":" + user[0]["tagAmount"] + ":" + user[0]["orderID"]) 
      }
      
    }
  } catch(err) {
    console.log("ERROR at line 456")
  }
})

app.post("/createUser", async(req, res) => {
  const body = req.body
  // sendMsg("917011238307", `${body.uName} registered for the extension`, true, "text")
  sendMsg(body.uPhone, `👋 ${body.uName}, welcome to Ennovation\n\nUse this WhatsApp integration to get a glimpse of your account details and all other stuff.\n\nType in to get started`, true, "text")
  try {
    await knex('e_users').insert({
      "uDOB": body.uDOB,
      "uPoints": 0,
      "uName" : body.uName,
      "uEmail": body.uEmail,
      "uPhoneNo": body.uPhone,
      "loginStreak": 0,
      "uGender": body.uGender,
      "achievements": "",
      "uAgeGroup": body.uAgeGroup,
      "interests": body.interests,
      "uPwd": body.uPwd,
      "lastLogin": body.lastLogin
    }) 
    
    res.send("SUCCESS")
  }
  catch(err) {
    res.send("ERORR at line 484")
  }
})

// recommendations section
app.post("/recommendations", async(req, res) => {
  const body = req.body
  
  try {
    const users = await knex('e_users').select('*').where({uEmail: body.email})
    if(!users.length) {
      res.send("ERROR:Wrong email used")
    } 
    else {
      let ans = []
      const interests = users[0]["interests"].split(" ") 
      console.log("INTERESTS " + interests.length)
      interests.forEach(async (item, ind) => {
        let products = await knex('e_products').select('*').where({
          "pCategory": item, "pGender": users[0]["uGender"], "pAgeGroup": users[0]["uAgeGroup"]
        })

        if(products.length) {
          products.forEach((item, ind) => {
            ans.push(item)
          })  
        }

        // second call to fetch products for every gender
        products = await knex('e_products').select('*').where({
          "pCategory": item, "pGender": "everyone", "pAgeGroup": users[0]["uAgeGroup"]
        })

        if(products.length) {
          products.forEach((item, ind) => {
            ans.push(item)
          })  
        }

        // third call to fetch products for every gender
        products = await knex('e_products').select('*').where({
          "pCategory": item, "pGender": users[0]["uGender"], "pAgeGroup": "everyone"
        })

        if(products.length) {
          products.forEach((item, ind) => {
            ans.push(item)
          })  
        }

        // fourth call to fetch products for every gender
        products = await knex('e_products').select('*').where({
          "pCategory": item, "pGender": "everyone", "pAgeGroup": "everyone"
        })

        // console.log("Products 4 length is " + products.length)
        if(products.length) {
          products.forEach((item, ind) => {
            ans.push(item)
          })  
        }


        if(ind == interests.length - 1) {
          res.send(ans)
        }
      })
      
    } 
  } catch (err) {
    console.log("Error at line 557")
  }
})

app.post("/createFeedback", async(req, res) => {
  const body = req.body
  
  await knex('e_feedback').insert({
    "uEmail" : body.email,
    "uName"  : body.name,
    "subject": body.type,
    "msg"    : body.msg
  }) 
  
  let sendTo = ""
  
  // if the feedback has to sent to a brand, then find the brand's email address:
  if(body.sendTo !== "") {
    sendTo = await knex('e_brands').select('*').where({"bName": body.sendTo})
    console.log("Feedback email will be sent to the brand: " + sendTo[0]['bEmail'])
    sendTo = sendTo[0]['bEmail']
  }
  
  console.log("Making the data object")
  let data = JSON.stringify({
    "name"  : body.name,
    "type"  : body.type,
    "msg"   : body.msg,
    "sendTo": sendTo
  });

  let config = {
    method: 'post',
    maxBodyLength: Infinity,
    url: 'https://versatilevats.com/squarehub/server.php?action=createFeedback',
    headers: { 
      'Content-Type': 'application/json'
    },
    data : data
  };

  axios.request(config)
  .then((response) => {
    console.log(JSON.stringify(response.data));
  })
  .catch((error) => {
    console.log("Create Feedback error: " + error);
  });

  
  const achievements = await knex('e_users').select('*').where({uEmail: body.email})
  
  //send a whatsapp message to the user regarding the submitted feeback
  let feedbackMsg = "*🥳 You just sent a feedback through the extension*\n\n"+
                    `*Type:* ${body.type}\n\n`+
                    `*Feedback content:* ${body.msg}`
  
  sendMsg(achievements[0]["uPhoneNo"], feedbackMsg, true, "text")
  
  // if achievements is already provided
  if(achievements[0]["achievements"].includes("f")) {
    res.send("SUCCESS")
  } else {
    await knex('e_users').where({uEmail: body.email}).update({achievements: achievements[0]["achievements"]+'f'})
    res.send("Achievement")
  }
})

app.get("/listBrands", async (req, res) => {
  const brands = await knex('e_brands').select('bName')
  if(!brands.length) res.send("ERROR:No brands found")
  else {
    res.send(brands)
  }
})

app.post("/getBrandProducts", async (req, res) => {
  let category = req.body.category
  let company = req.body.company
  let gender = req.body.gender
  let age = req.body.age
  
  if(category === "default") category = "%"
  if(company === "default") company = "%"
  if(gender === "default") gender = "%"
  if(age === "default") age = "%"
  
  const brandProducts = await knex('e_products').select('*')
    .whereLike('companyName', company)
    .andWhereLike('pCategory', category)
    .andWhereLike('pGender', gender)
    .andWhereLike('pAgeGroup', age)
  
  if(!brandProducts.length) res.send("ERROR:No products available for the selected combination")
  else res.send(brandProducts)
})

// AI-ML endpoint
app.post("/getLabelProducts", async (req, res) => {
  let labels = req.body.labels
  let finalResult = []
  
  for(let label=0; label<labels.length; label++) {
    let products = await knex('e_products').select('*').where({label: labels[label]})
    products.forEach(prod => {
      finalResult.push(prod)
    })
  }
    res.send(finalResult)
})

app.post("/getAchievements", async (req, res) => {
  const achievements = await knex('e_users').select('achievements').where({uEmail: req.body.email})
  res.send(achievements[0]["achievements"])
})

app.post("/updateVerify", async (req, res) => {
  const achievements = await knex('e_users').select('achievements').where({uEmail: req.body.email})
  // if achievements is already provided
  if(achievements[0]["achievements"].includes("v")) {
    res.send("SUCCESS")
  } else {
    await knex('e_users').where({uEmail: req.body.email}).update({achievements: achievements[0]["achievements"]+'v'})
    res.send("Achievement")
  }
})

// chart endpoints:
app.get("/getChartValues", async(req, res) => {
  const males = await knex("e_users").count('*').where({uGender: "m"})
    const females = await knex("e_users").count('*').where({uGender: "f"})
    
    const kids = await knex("e_users").count('*').where({uAgeGroup: "kids"})
    const youth = await knex("e_users").count('*').where({uAgeGroup: "youth"})
    const adult = await knex("e_users").count('*').where({uAgeGroup: "adult"})
    const old = await knex("e_users").count('*').where({uAgeGroup: "old"})
    
    const clothing = await knex("e_products").count('*').where({pCategory: "clothing"})
    const food = await knex("e_products").count('*').where({pCategory: "food"})
    const furniture = await knex("e_products").count('*').where({pCategory: "furniture"})
    const electronics = await knex("e_products").count('*').where({pCategory: "electronics"})
    
    const genderCounts = []
    genderCounts.push(males[0]["count(*)"])
    genderCounts.push(females[0]["count(*)"])
    
    const ageGroupCounts = []
    ageGroupCounts.push(kids[0]["count(*)"])
    ageGroupCounts.push(youth[0]["count(*)"])
    ageGroupCounts.push(adult[0]["count(*)"])
    ageGroupCounts.push(old[0]["count(*)"])
    
    const productCounts = []
    productCounts.push(clothing[0]["count(*)"])
    productCounts.push(food[0]["count(*)"])
    productCounts.push(electronics[0]["count(*)"])
    productCounts.push(furniture[0]["count(*)"])
    
    const finalArray = []
    finalArray.push(genderCounts)
    finalArray.push(ageGroupCounts)
    finalArray.push(productCounts)
  
    res.send(finalArray)
})

app.post("/statEmails", async (req, res) => {
  const body = req.body
  
  if(body.msg == "") {
    res.send("ERROR:Message cannot be empty")
    return
  }
  
  const users = await knex('e_users').select('*').where({uAgeGroup: body.ageGroup, uGender: body.gender})
  if(!users.length) res.send("ERROR:Selected combinations has no user")
  else {
    for(let a=0; a<users.length; a++) {
      let data = {
        "to": users[a]["uEmail"],
        "companyName": body.companyName.toUpperCase(),
        "msg": body.msg,
        "attachment": body.attachment
      };

      if(!body.attachment || body.attachment === "") {}
      else data["attachment"] = body.attachment

      data = JSON.stringify(data)

      console.log("Data is: " + data)

      let config = {
        method: 'post',
        maxBodyLength: Infinity,
        url: 'https://versatilevats.com/squarehub/server.php?action=sendAttachment',
        headers: { 
          'Content-Type': 'application/json'
        },
        data : data
      };

      axios.request(config)
      .then((response) => {
        console.log(JSON.stringify(response.data));
      })
      .catch((error) => {
        console.log("Send Attachment error: " + error);
      }); 
    }
    
    res.send("SUCCESS")
  }
})

// Square and hardware related calls
app.post("/processPayments", async (req, res) => {
  let nonceToken = req.body.token
  let amount = req.body.amount*100
  let email = req.body.email
  console.log(nonceToken, amount, email)

  try {
    const payment = await client.paymentsApi.createPayment({
        sourceId: nonceToken,
        idempotencyKey: uuid.v4(),
        amountMoney: {
          amount: amount,
          currency: 'USD'
        },
        autocomplete: true,
        locationId: process.env.LOCATION_ID
    });
    await knex('e_users').where({uEmail:email}).update({orderID: JSON.parse(payment.body).payment.id})
    res.send(JSON.parse(payment.body).payment.id)
  } catch(err) {
    console.log(err)
    res.send("ERROR")
  }
});

app.post("/addAmountTotag", async(req, res) => {
  const body = req.body
  console.log(body.email, body.amount)
  await knex('e_users').where({uEmail:body.email}).update({tagAmount: body.amount})
  res.send("OKAY")
})

app.get("/checkOrder", async(req, res)=> {
  const tag = req.query["tag"]
  console.log(tag)

  const order = await knex('e_users').select('*').where({tag: tag})
  if(!order.length) {
    res.send("UNKNOWN TAG")
  } else {
    if(order[0]['orderID'] == "" || order[0]['tagAmount'] == 0) {
      res.send("NO TAG ORDERS")
    } else if(order[0]['orderID'] != "" && order[0]['tagAmount'] > 0) {
      console.log(`${order[0]['tagAmount']}`)
      res.send(`Amount: $${order[0]['tagAmount']}`)
    }
  }
})

app.get("/processPayment", async(req, res) => {
  const tag = req.query["tag"]
  console.log("Process payments " + tag)

  const order = await knex('e_users').select('*').where({tag: tag})
  if(!order.length) {
    res.send("NO TAG ORDERS")
  } else {
    if(order[0]['tagAmount'] == 0) {
      res.send("NO TAG ORDERS")
    } else {
      await knex('e_users').where({tag: tag}).update({orderID: "", tagAmount: 0})
      res.send("PURCHASE DONE") 
    } 
  }
})
