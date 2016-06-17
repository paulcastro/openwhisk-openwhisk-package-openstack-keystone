////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
//  Get Auth Token from Keystone
//
//  Will retrieve the auth token and storage URL for the object store service.  Uses V3 of the auth calls
//
//  The params object should look like:
// 
//  "userId":"f45adsa0d0478c", "password":"sd2rsS^kdfsd", "projectId":"11fdseerff"}
//
//  @param userId: user id (not user name)
//  @param password: password
//  @param projectId: project/tenantId
//  @param host: hostname of keystone endpoint (don't include 'https://')
//  @param port: port of keystone endpoint
//  @param endpointName: the name of the public endpoint service you want (nova, swift, etc)
//  
//
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////


var https = require('https')
var url = require('url')

function main(params) {

    if (!params.userId || !params.password || !params.projectId || !params.host || !params.port || !params.endpointName) {
        return whisk.error("Missing required parameters")
    }

    console.log('getApiToken. Params '+JSON.stringify(params))

    var userId = params.userId
    var password = params.password
    var projectId = params.projectId
    var pathPrefix = ""
    var host = params.host
    var port = params.port
    var endpointName = params.endpointName

    // customize your path here.
    if (params.pathPrefix) {
        pathPrefix = params.pathPrefix
    }

    var context = null
    if (params.context) {
        context = params.context
    }

   
    var body = {
    "auth": {
        "identity": {
            "methods": [
                "password"
            ],
            "password": {
                "user": {
                    "id": userId,
                    "password": password
                }
            }
        },
        "scope": {
            "project": {
                "id": projectId
            }
        }
    }
}

    var headers = {
       'Content-Type': 'application/json',
       'Content-Length': Buffer.byteLength(JSON.stringify(body), ['utf8'])
    };

    var options = {
        host: host,
        port: port,
        path: '/'+pathPrefix+'/v3/auth/tokens',
        method: 'POST',
        headers: headers
    };

    var postRequest = https.request(options, function(res) {
    
        var json = ''
        //console.log('STATUS: ' + res.statusCode);
        console.log('HEADERS: ' + JSON.stringify(res.headers));
        
        var authToken = res.headers['x-subject-token']
        
        //console.log('TOKEN: ' + authToken)
        res.setEncoding('utf8');
        res.on('data', function (chunk) {
            json += chunk 
        });
        
        res.on('end', function() {
        
            console.log(json)
            
            var j = JSON.parse(json)
            var entries = j.token.catalog
            
            for (var i = 0; i < entries.length; i++) {
                var entry = entries[i]
                console.log('Comparing '+ entry.name + " with "+endpointName)
                if (entry.name === endpointName) {
                    var endpoints = entry.endpoints

                    console.log('Got endpoints '+endpoints)
                    for (var j = 0; j < endpoints.length; j++) {
                        var endpoint = endpoints[j]
                        if (endpoint.interface === 'public') {
                           console.log('Public endpoint is ' + endpoint.url)
                           console.log('Auth token is ' + authToken)

                           var urlParts = url.parse(endpoint.url,true)

                           var jsonResponse = {apiToken: authToken, 
                            endpointUrl: endpoint.url, 
                            host: urlParts.hostname, 
                            port: urlParts.port, 
                            path: urlParts.path, 
                            protocol: urlParts.protocol}

                            if (context) {
                                jsonResponse.context = context
                            }

                           return whisk.done(jsonResponse)
                        }
                    }
                }
            }

            return whisk.error("Cannot find public endpoint in response from keystone")
        
        });
    });

    postRequest.write(JSON.stringify(body));
    postRequest.end();

    return whisk.async()
    
}
