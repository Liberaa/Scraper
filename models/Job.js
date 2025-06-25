import mongoose from 'mongoose'

const jobSchema = new mongoose.Schema({
  title: String,
  company: String,
  location: String,
  url: String,
    description: String  // Lägg till description här
})

export default mongoose.model('Job', jobSchema)
