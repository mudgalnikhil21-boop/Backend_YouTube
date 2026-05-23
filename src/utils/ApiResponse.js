class ApiResponse {
    constructor(statusCode, data, messgae = "Success")
    {
        this.statusCode = statusCode
        this.data = data
        this.message = message
        this.success = statusCode < 400
    }
}

export {ApiResponse}