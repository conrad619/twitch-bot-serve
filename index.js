const express = require('express');
const tmi = require('tmi.js');
const axios = require('axios');
require('dotenv').config()
const path = require('path');
const { stringify } = require('querystring');




const port = process.env.PORT || 8080

const token = {
    twitch:{
        "token_endpoint": "https://id.twitch.tv/oauth2/token",
        "client_id":process.env.CLIENT_ID,
        "client_secret":process.env.CLIENT_SECRET
    }
}


const app = express()
app.use(express.urlencoded({ extended: false }))
app.use(express.json())
app.engine('html', require('ejs').renderFile);
app.set('view engine', 'html');

// var list_of_users_who_enter = []
// var winner=null
// var sendingGift=true
// var timerCountToWinner=5000
// var messages = []
var clients = []
var redirect_uri = "http://localhost:3000"
redirect_uri = window.location.origin;
var winner_host = null
var state_winner = null
// var redirect_uri = "http://localhost:8080"
// var redirect_uri = "https://twitchbotserve-1-e4702823.deta.app"
// var redirect_uri = "https://twitch-dmdn.onrender.com"


/*

Functions start

*/

async function fetchToken (code){
    
    return axios({
        method: 'post',
        url: token.twitch.token_endpoint,
        params: {
            client_id: token.twitch.client_id,
            client_secret: token.twitch.client_secret,
            code: code,
            grant_type: 'authorization_code',
            redirect_uri: `${redirect_uri}`

        },
        responseType: 'json'
    }).then(async function (response) {
        // handle success
        console.log("success token fetch")

        responseBody = await response.data;

        return tokenResponse = JSON.parse(JSON.stringify(responseBody))

    }).catch(async function (error) {
        console.log("fetch token error")
        console.log(error.data)
        return await error
    })
}

async function connect(access_token,state){
    const client = await new tmi.Client({
        options: { debug: true },
        connection: {
            secure: true,
            reconnect: true
        },
        identity: {
            username: `${clients[state].username}`,
            password: `oauth:${access_token}`
        },
        channels: [`${clients[state].channel}`]
    });
    console.log("connecting")
    clients[state].messages = []

    await setupBehavior(client,state)

    await client.connect();

    
    clients[state].client = client
    clients[state].access_token = access_token

    console.log("bot joined")
    try {
        await client.say(clients[state].channel, `Twitch Bot Witsz has joined the chat!1!!1!!`);
        
    } catch (error) {
        console.log(error)
        await error
    }


}

async function setupBehavior(client,state){

    console.log("setup")
    await client.on('message', (channel, tags, message) => {
        let helloCommand = "!hello"
        let enterCommand = "!enter"

        //! means a command is coming by, and we check if it matches the command we currently support
        if (message.startsWith('!') && message === helloCommand)
            client.say(channel, `Hello, ${ tags.username }! Welcome to the channel.`);
            console.log("saying hello")
        if (message.startsWith('!') && message === enterCommand && clients[state].sendingGift){
            clients[state].list_of_users_who_enter.push(tags)
        }
            
        clients[state].messages.push(message+"<br>")
    })
}

async function announceGiveAway(gifter,product,access_token,state,order_id,shop_id,checkout_token){
    await axios({
        method: 'post',
        url: 'https://api.twitch.tv/helix/chat/announcements',
        params: {
            broadcaster_id: '92422518',
            moderator_id: '92422518',
        },
        headers: {
            'Authorization': `Bearer ${access_token}`,
            'Client-Id':token.twitch.client_id,
            'Content-Type': 'application/json'
        },
        data:{
            message:`${gifter} is giving away ${product}, type !enter for a chance to win!`,
            color:"green"
        },
        responseType: 'json'
    }).then(async function (response) {
        // handle success
        console.log("success anouncement")
        data = await response
        clients[state].list_of_users_who_enter = []
        clients[state].winner=null
        clients[state].sendingGift=true
        clients[state].timerCountToWinner=5000
        clients[state].gifter = gifter
        clients[state].product = product
        clients[state].order_id = order_id
        clients[state].shop_id = shop_id
        clients[state].checkout_token = checkout_token
        console.log("sending gift activated")

        clients[state].timeout = setTimeout(()=>{
            const random = Math.floor(Math.random()*clients[state].list_of_users_who_enter.length)
            clients[state].winner = clients[state].list_of_users_who_enter[random]
            winner_host = clients[state].host
            state_winner = state
            if(clients[state].list_of_users_who_enter.length > 0){
                announceWinner(clients[state].winner,clients[state].product,clients[state].access_token,state)
            }else{
                console.log("timerr expired")
            }
            // else{
            //     announceGiveAway(clients[state].gifter,clients[state].product,clients[state].access_token,clients[state].state)
            // }
            clients[state].sendingGift=false
        },clients[state].timerCountToWinner)
        console.log("activated timer")

        return data
        
    }).catch(async function (error) {
        console.log("Failed to announce");
        if (error.response) {
            // The request was made and the server responded with a status code
            // that falls out of the range of 2xx
            console.log(error.response.data)
            return await error.response.data
        }
    })
}

async function announceWinner(winner,product,access_token,state){
    console.log("announcing winnner")

    const setwinner_data = {
        checkout_token:clients[state].checkout_token,
        channel:clients[state].channel,
        username:winner.username,
        order_id:clients[state].order_id,
        shop_id:clients[state].shop_id
    }

    let loginTwitchUrl = 'http://localhost:3000/claim'
    let url = null

    await axios({
        method: 'post',
        url: `https://${clients[state].host}/api/set_winner?shop=${clients[state].store}`,
        headers: {
            'Content-Type': 'application/json',
            'X-Shopify-Access-Token': `${clients[state].shopifyToken}`,
        },
        data:setwinner_data,
        responseType: 'json'
    }).then(async function (response) {
        console.log("sending winner to oblivion")
        
        // console.log(response)

        // await axios({
        //     method: 'post',
        //     url: `https://${winner_host}/api/get_form?host=${winner_host}`,
        //     headers: {
        //         'Content-Type': 'application/json',
        //         'X-Shopify-Access-Token': `${clients[state].shopifyToken}`,
        //     },
        //     data:{
        //         access_token:access_token,
        //         order_id:clients[state].order_id,
        //         shop_id:clients[state].shop_id,
        //         channel:clients[state].channel
        //     },
        //     responseType: 'json'
        // }).then(async function (response) {
        //     console.log("received url")
        //     console.log(response)

        //     responseBody = await response.data;

        //     console.log(responseBody)

        //     url = JSON.parse(JSON.stringify(responseBody)).form_url

        // }).catch(function(error){
        //     console.log("error receiving url form link")
        //     console.log(error)
        // })

        
    }).catch(function (error) {
        console.log("error setting winner")
        console.log(error)
    })

    await axios({
        method: 'post',
        url: 'https://api.twitch.tv/helix/chat/announcements',
        params: {
            broadcaster_id: '92422518',
            moderator_id: '92422518',
        },
        headers: {
            'Authorization': 'Bearer '+access_token,
            'Client-Id':token.twitch.client_id,
            'Content-Type': 'application/json'
        },
        data:{
            message:`GIVEAWAY WINNER ANNOUNCEMENT, ${winner.username} have won a ${product} gift merch. click link ${loginTwitchUrl} to claim your gift`,
            color:"green"
        },
        responseType: 'json'
    }).then(async function (response) {
        // handle success
        console.log("success winner anouncement")
        clients[state].list_of_users_who_enter=[]
        clients[state].winner=null

        
        // console.log(response)
        
    }).catch(async function (error) {
        console.log("Failed to announce winner");
        console.log(error)
        // if (error.response) {
        //     // The request was made and the server responded with a status code
        //     // that falls out of the range of 2xx
        //     console.log(error.response.data)
            
        // }
    })

}

async function announce(message,access_token){
    console.log("announcing")
    await axios({
        method: 'post',
        url: 'https://api.twitch.tv/helix/chat/announcements',
        params: {
            broadcaster_id: '92422518',
            moderator_id: '92422518',
        },
        headers: {
            'Authorization': 'Bearer '+access_token,
            'Client-Id':token.twitch.client_id,
            'Content-Type': 'application/json'
        },
        data:{
            message:`${message}`,
            color:"green"
        },
        responseType: 'json'
    }).then(async function (response) {
        // handle success
        console.log("success anouncement")
        return await response.data
        
    }).catch(async function (error) {
        console.log("Failed to announce");
        if (error.response) {
            // The request was made and the server responded with a status code
            // that falls out of the range of 2xx
            console.log(error.response.data)
            return await error.response.data
        }
    })
}




/*

Functions end

*/



/*

API start

*/

app.get('/', (req, res) => {
    html = `<form method="get" action="/api/auth">
        <label>username</label>
        <input type="text" name="username" value="witsz">
        <label>channel</label>
        <input type="text" name="channel" value="witsz">
        <label>store</label>
        <input type="text" name="store" value="https://gamers-pixel.myshopify.com">
        <label>state</label>
        <input type="text" name="state" id="state" value="">
        <script>document.getElementById("state").value = [...Array(30)].map(() => Math.random().toString(36)[2]).join('')</script>
        <input type="submit" value="submit">
        PORT ${process.env.PORT}
    </form>`
    res.send(html)
})

app.get('/api/auth', (req, res) => {
    const username = req.query.username
    const channel = req.query.channel
    const store = req.query.store
    const state = req.query.state
    const session = req.query.session
    const host = req.query.host
    
    console.log("session:%o",session)
    console.log("store:%o",store)
    console.log("host:%o",host)
    console.log("username:%o",username)
    // var html = `<a href="https://id.twitch.tv/oauth2/authorize?response_type=code&client_id=9egbqe7dfh8hb291qvxmhykqamhu29&redirect_uri=${redirect_uri}/api/join&scope=chat%3Aread%20chat%3Aedit%20moderator%3Amanage%3Aannouncements%20user%3Aread%3Abroadcast%20moderation%3Aread&state=${state}">connect</a>`
    const link = `https://id.twitch.tv/oauth2/authorize?response_type=code&client_id=9egbqe7dfh8hb291qvxmhykqamhu29&redirect_uri=${redirect_uri}/api/join&scope=chat%3Aread%20chat%3Aedit%20moderator%3Amanage%3Aannouncements%20user%3Aread%3Abroadcast%20moderation%3Aread&state=${state}`;
    // res.send(html)
    // res.render(path.join(`join.html`),{link:link})
    if(username != undefined && channel != undefined && store != undefined && state != undefined    ){
        clients[state] = {"username":username,"channel":channel,"store":store,"state":state,"shopifyToken":session,"host":host}

        const data = {
            message: "success",
            link: link,
            state:state
        }
        res.status(200).json(data)
    }else{
        res.status(400).send("username, channel, store and state are required")
    }
})

app.get('/api/join', async (req, res) => {
    const code = req.query.code
    const state = req.query.state
    console.log("code:"+code)

    const access_token = await (await fetchToken(code)).access_token
    console.log("accesstoken:"+access_token)
    console.log("state:"+state)


    if(access_token){
        await connect(access_token,state)
        const data = {
            channel:clients[state].channel,
            auth_code:access_token,
            state:state,
        }
        var result = null
        await axios({
            method: 'post',
            url: `https://${clients[state].host}/api/twitch_auth?shop=${clients[state].store}`,
            headers: {
                'Content-Type': 'application/json',
                'X-Shopify-Access-Token': `${clients[state].shopifyToken}`,
            },
            data:data,
            responseType: 'json'
        }).then(function (response) {
            // handle success
            // console.log("success sent twitch auth to shopify")
            // console.log(response)
            result = response
            
        }).catch(function (error) {
            // console.log("failed sent twitch auth to shopify")
            // console.log(error)

            result=error
        })
        // /api/twitch_auth
        // <a href="javascript:close_window();">close</a>
        // res.status(200).send("success sent to twitch auth"+result)
        res.render(path.join('successfully-connected.html'));

    }
    else{
        res.status(400).send("failed to fetch access token, code invalid")
    }

    
})

app.get('/api/announce-giveaway', async (req, res) => {
    const shop_id = req.query.shop_id
    const gifter = req.query.gifter
    const product = req.query.product_name
    const variant = req.query.variant_name
    const product_title = product + " " + variant
    const state = req.query.state
    const access_token = req.query.access_token
    
    console.log("state: "+state)
    console.log("clients")
    clients.forEach(e=>{
        console.log(e)
    })
    console.log("client:"+clients[state])
    
    const order_id = req.query.order_id
    const checkout_token = req.query.checkout_token


    if(clients[state].access_token == access_token){
        result = await announceGiveAway(gifter,product_title,access_token,state,order_id,shop_id,checkout_token)
        const data = {
            message:"success"
        }
        res.status(200).json(data)
    }else{
        const data = {
            message:"failed announcement, invalid access token"
        }
        res.status(400).json(data)
    }
})


// app.get('/api/claim', async (req, res) => {
//     const product = req.query.product
//     const state = req.query.state
//     const access_token = req.query.access_token
//     console.log(clients[state].access_token)
//     if(clients[state].access_token == access_token){
//         result = await announceClaim(product,access_token,state)
//         const data = {
//             message:"success"
//         }
//         res.status(200).json(data)
//     }else{
//         const data = {
//             message:"failed announcement, invalid access token"
//         }
//         res.status(400).json(data)
//     }
// })



app.get('/api/fetch_token', async (req, res) => {

    const code = req.query.code
    const state = req.query.state

    console.log("feting winner token")
    const access_token = await (await fetchToken(code)).access_token

    console.log(access_token)
    let  getform_data = null
    try{
        getform_data = {
            access_token: access_token,
            checkout_token: clients[state].checkout_token,
            shop:clients[state].store
        }
    }catch(err){
        console.log(err)
        res.status(400).send(err)
    }

    console.log(clients)
    console.log("fetch token state:"+state)
    console.log("fetch token state_winner:"+state_winner)
    console.log("fetch token winner_host:"+winner_host)
    console.log("fetch token state:"+clients[state])
    console.log("fetch token shopifyToken:"+clients[state].shopifyToken)

    await axios({
        method: 'post',
        url: `https://${winner_host}/api/get_form?host=${winner_host}`,
        headers: {
            'Content-Type': 'application/json',
            'X-Shopify-Access-Token': `${clients[state].shopifyToken}`,
        },
        data:getform_data,
        responseType: 'json'
    }).then(async function (response) {
        console.log("received url")
        console.log(response)

        responseBody = await response.data;

        // console.log(responseBody)

        url = JSON.parse(JSON.stringify(responseBody)).form_url

        res.redirect(url)
        // res.status(200).send(""+url)
    }).catch(function(error){
        console.log("error receiving url form link")
        console.log(error)
    })
})


app.get('/claim', async (req, res) => {
    //redirect to login that says login to twitch to verify winner
    //authorize
    //redirects to api/claim
    //call shopify api claim with accesstoken/code
    res.render(path.join('login.html'));

})

app.get('/login', async (req, res) => {
    console.log("login state:"+state_winner)
    res.redirect(`https://id.twitch.tv/oauth2/authorize?response_type=code&client_id=9egbqe7dfh8hb291qvxmhykqamhu29&redirect_uri=${redirect_uri}/api/fetch_token&scope=chat%3Aread&state=${state_winner}`)
})

/*

API end

*/


app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})