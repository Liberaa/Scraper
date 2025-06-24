import mongoose from 'mongoose'

const jobSchema = new mongoose.Schema({
  title: String,
  company: String,
  location: String,
  url: String
})

export default mongoose.model('Job', jobSchema)
