## Description

This is a a single-purpose stop gap. 

### Problem:
The wonderful site [ZFIN](www.zfin.org) provides a user interface that allows
zebrafish researcher to peruse a wealth of zebrafish genetics information.

Of the many classes of objects available there, there are two Mutations and Transgnes
which are known to the research community by an abbreviated name called which is loosely
refered to as an allele. To all intents and purposes, the allele is a human friendly identifier
for a mutation or a transgene.  The formal identifier is a ZFIN_Id is not human friendly,
but it is the key by which other systems know a particular mutation or transgene.

A particular system exists that knows a an allele name, but wants the ZFIN_Id and the only
way to get it is to have the user manually go to zfin, type in the allele name, copy the
ZFIN_Id and paste it into the other system. 

An API could achieve the same thing much more efficiently, but there is no such API available.

### The Solution

This application simply creates an API that allows it's client to supply and allele name
and get a ZFIN_Id in return.

### The Implementation

1. On a daily basis, ZFIN publishes a downloadable tab separated value list of mutations
   and another of transgenes.
1. Also on a daily basis, this system reads both those lists and uses that data to 
   populate a simple database
1. This system provides some very simple API calls to access the database

## Work Flow

### Installation

Clone the repo

```bash
$ npm install
```

### Create a mySQL database - development and production

The code assumes mySQL, though in theory you caould use whatever database you want.
You need to create a user and a database in mysql.
The code will create tables automatically.

### Configure the application - development

Edit the .development.env file - the instructions in that file are pretty clear.

### Configure the application - production

Edit a .env file which should be similar to the .development.env file except that
1. The database should have a good password
1. It should not be committed to git :)

### Build - production

npm run build

### Run the app - development

This also build the app.

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

### Run the loaders - development

During development you can trigger the loaders manually through the API with:
```
http://localhost:your-port/mutation/loadFromZfin
http://localhost:your-port/transgene/loadFromZfin
```

Note: While working on the system, you should probably store abbreviated versions to the
ZFIN download files on your local server and configure your system to access those files
to avoid repeatedly downloading the large ZFIN files.

### Run the API - production

#### Loader
You need to run the loaders as a once a day cron job.

### API Server
Run the API as a service to ensure some resilience over restarts.
For example, using systemd on Linux. 

### Web Access to API

Also, you will need a domain name for the site and map that domain to your host system.

Your system probably alread has a web server like Apache2.  If not you have to install one.
Configure it with a virtual site which will pass
requests through to your node server.  


