const express = require('express');
const cors = require('cors');
var jwt = require('jsonwebtoken');
require('dotenv').config()
const app = express();
const port = process.env.PORT || 4000;
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY)

// Midlleware
app.use(cors())
app.use(express.json())




// Mongodb
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ucglodm.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    const usersCollection = client.db("educationDB").collection('users')
    const coursesCollection = client.db("educationDB").collection('courses')
    const pendingClassCollection = client.db("educationDB").collection('pendingClass')
    const paymentsCollection = client.db("educationDB").collection('payments')
    const enrollCollection = client.db("educationDB").collection('enroll')
    const feedbackCollection = client.db("educationDB").collection('feedback')


    // JWT
    app.post('/jwt', async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })
      res.send({ token })
    })


    // Middleware
    const verifyToken = (req, res, next) => {
      console.log('inside verify token', req.headers?.authorization?.split(' ')[1]);
      if (!req.headers?.authorization) {
        return res.status(401).send({ messege: "Unauthorized access" })
      }

      const token = req.headers?.authorization?.split(' ')[1]
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(401).send({ messege: "Unauthorized access" })
        }
        req.decoded = decoded
        next();
      })
    }

    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded?.email;
      const query = { email: email }
      const user = await usersCollection.findOne(query)
      // console.log({ user, email });
      const isAdmin = user?.role === 'admin';
      if (!isAdmin) {
        return res.status(403).send({ messege: "Forbidden Access" })
      }
      next();
    }

    // Users
    app.get('/users', verifyToken, verifyAdmin, async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result)
    })


    // Post
    app.post('/users', async (req, res) => {
      const user = req.body;
      const query = { email: user.email }
      const existingUser = await usersCollection.findOne(query)
      if (existingUser) {
        return res.send({ messege: "User Already Exist", insertedId: null })
      }
      const result = await usersCollection.insertOne(user)
      res.send(result)
    })


    // Teachers
    app.get('/users/teachers', verifyToken, async (req, res) => {
      const query = { role: 'requested for teacher' }
      const result = await usersCollection.find(query).toArray();
      res.send(result)
    })




    // Courses 
    app.post('/courses', verifyToken, verifyAdmin, async (req, res) => {
      const courseData = req.body
      console.log(courseData);
      const result = await coursesCollection.insertOne(courseData)
      res.send(result);
    })

    app.get('/courses', async (req, res) => {
      const page = parseInt(req.query.page);
      const size = parseInt(req.query.size);
      // console.log('Pagination: ', page, size);
      const result = await coursesCollection.find()
        .skip(page * size)
        .limit(size)
        .toArray();
      res.send(result);
    })

    app.patch('/courses/update/:id', verifyToken, async (req, res) => {
      const id = req.params.id;
      const classData = req.body;
      console.log(classData);
      const query = { _id: new ObjectId(id) }
      const doc = {
        $set: {
          title: classData?.title,
          category: classData?.category,
          enrollment: classData?.price,
          description: classData?.description,
          image_url: classData?.photoUrl,
        }
      }
      const result = await coursesCollection.updateOne(query, doc)
      res.send(result)
    })

    app.get('/coursesCount', async (req, res) => {
      const count = await coursesCollection.estimatedDocumentCount();
      res.send({ count });
    })


    // Pending Class
    app.post('/pendingClass', verifyToken, async (req, res) => {
      const classData = req.body;
      console.log(classData);
      const result = await pendingClassCollection.insertOne(classData)
      res.send(result);
    })

    app.get('/pendingClass', verifyToken, verifyAdmin, async (req, res) => {
      const result = await pendingClassCollection.find().toArray();
      res.send(result);
    })

    app.delete('/pendingClass/:id', verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await pendingClassCollection.deleteOne(query)
      res.send(result)
    })

    // Enroll

    app.post('/enroll', async (req, res) => {
      const course = req.body;
      const result = await enrollCollection.insertOne(course)
      res.send(result);
    })

    app.get('/enroll', verifyToken, async (req, res) => {
      const result = await enrollCollection.find().toArray();
      res.send(result);
    })


    // Payment Intent
    app.post('/create-payment-intent', async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price)
      console.log("Amount:", amount);

      const paymentIntent = await stripe.paymentIntents.create({
        amount,
        currency: 'usd',
        payment_method_types: ['card']
      })

      res.send({
        clientSecret: paymentIntent.client_secret,
      })
    })

    app.post('/payments', async (req, res) => {
      const payment = req.body;
      // console.log(payment);
      const result = await paymentsCollection.insertOne(payment)
      res.send(result)
    })

    app.get('/payments', verifyToken, async (req, res) => {
      const result = await paymentsCollection.find().toArray();
      res.send(result);
    })


    app.post('/feedback', async (req, res) => {
      const feedback = req.body;
      const result = await feedbackCollection.insertOne(feedback);
      res.send(result);
    })

    app.get('/feedback', async (req, res) => {
      const result = await feedbackCollection.find().toArray();
      res.send(result)
    })


    // Get User Id

    app.get('/details/user/:email', verifyToken, async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const result = await usersCollection.findOne(query)
      res.send(result);
    })

    app.patch('/phone/number/:email', verifyToken, async (req, res) => {
      const { phone } = req.body
      // console.log(phone);
      const email = req.params.email;
      const query = { email: email }
      const doc = {
        $set: {
          phone: phone
        }
      }
      const result = await usersCollection.updateOne(query, doc)
      res.send(result)
    })

    app.get('/users/details/:id', verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await usersCollection.findOne(query)
      res.send(result)
    })

    // Delete
    app.delete('/users/details/:id', verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await usersCollection.deleteOne(query)
      res.send(result)
    })

    // Check email
    app.get('/users/get/:email', verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded?.email) {
        return res.status(403).send({ messege: "Forbidden" })
      }
      const query = { email: email }
      const user = await usersCollection.findOne(query);
      let teacher = false;
      let student = false;
      let admin = false;
      if (user) {
        teacher = user?.role === 'teacher'
        student = user?.role === 'student'
        admin = user?.role === 'admin'
      }
      res.send({ teacher, student, admin })
    })


    // Admin
    app.patch('/users/admin/:id', verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const doc = {
        $set: {
          role: "admin"
        }
      }
      const result = await usersCollection.updateOne(query, doc)
      res.send(result)
    })

    // Student
    app.patch('/student/:email', verifyToken, async (req, res) => {
      const email = req.params.email;
      const query = { email }
      const doc = {
        $set: {
          role: "student"
        }
      }
      const result = await usersCollection.updateOne(query, doc)
      res.send(result)
    })



    app.patch('/users/teachers/request/:email', verifyToken, async (req, res) => {
      const email = req.params.email;
      const item = req.body;
      // console.log(item);
      const query = { email: email }
      const doc = {
        $set: {
          role: "requested for teacher"
        }
      }
      const result = await usersCollection.updateOne(query, doc)
      res.send(result)
    })

    // Update teacher id
    app.patch('/users/teachers/:id', verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const doc = {
        $set: {
          role: "teacher"
        }
      }
      const result = await usersCollection.updateOne(query, doc)
      res.send(result)
    })

    app.delete('/users/teachers/:id', verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await usersCollection.deleteOne(query);
      res.send(result)
    })


    app.get('/courses/:id', verifyToken, async (req, res) => {
      const id = req.params.id
      const query = { _id: new ObjectId(id) }
      const result = await coursesCollection.findOne(query)
      res.send(result);
    })

    app.get('/courses/your/:email', verifyToken, async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const result = await coursesCollection.find(query).toArray();
      res.send(result)
    })

    app.delete('/courses/:id', verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await coursesCollection.deleteOne(query)
      res.send(result)
    })

    app.get('/enroll/:email', verifyToken, async (req, res) => {
      const email = req.params.email
      const query = { email: email }
      const result = await enrollCollection.find(query).toArray();
      res.send(result);
    })


    app.get('/payments/:email', verifyToken, async (req, res) => {
      const email = req.params.email
      const query = { email: email }
      const result = await paymentsCollection.find(query).toArray();
      res.send(result);
    })



    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    // console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
  res.send("Here's your educational server")
})

app.listen(port, () => {
  console.log(`Your server is opening on port: ${port}`);
})