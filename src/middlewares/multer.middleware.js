import multer from "multer"

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, './public/temp')
  },
  filename: function (req, file, cb) {
    // here we should modify the file name before saving it to the disk, for example we can add a timestamp to make it unique so files are not overwritten
    cb(null, file.originalname)
  }
})

const upload = multer({
  storage,
 })

export {upload}