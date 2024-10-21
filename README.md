# EDB SWE Assignment code

## Notes on hosting on AWS

Since AWS offers a wide range of services for hosting APIs, some key parts of this code will change depending on how the service is to be used.

E.g if this is a low traffic service, it would be preferable to host it using AWS Lambda as the serverless compute base (which would require some re-writes of the code, but the main functionality and logic will remain unchanged)

AWS Gateway and DynamoDB are the preferred choices for handling REST APIs, and most security concerns can be handled via AWS services natively without bloating the code. Alternatively, other options such as Cloudflare can be considered for traffic control and DDOS protection. 

The cloudformation.txt serves as a basic stack example that could be used to set up a serverless REST API solution. Do take note that the nodejs service in this repo is NOT ideal for serverless runs (e.g AWS Lambda). Otherwise, an alternative is to host it on AWS EC2.


# Requirements
1. NodeJS
2. Docker

# Setting up for local runs (UNIX/WSL/MACOS)
1. Install nodejs, npm
    - Recommend to use NVM for managing nodejs https://github.com/nvm-sh/nvm
2. Install docker engine for your system

## Setting up local MongoDB on docker
```
$ docker pull mongodb/mongodb-community-server:latest
$ docker run --name mongodb -p 27017:27017 -d mongodb/mongodb-community-server:latest
$ docker ps # Check if container is running
$ mongosh --port 27017 # Connect to mongoDB container
```

Create testUser inside mongosh session
```
use membership_db

db.createUser({
    user:"testUser",
    pwd:"abc123",
    roles:[{role:"readWrite",db:"membership_db"}],
    passwordDigestor:"server"
})
```

## Run server locally
```
$ npm install
$ npm start
```
