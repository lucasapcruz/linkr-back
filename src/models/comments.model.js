import Joi from "joi";

const commentSchema = Joi.object({
    postId: Joi.number().required(),
    message : Joi.string().min(3).required()
})

export default commentSchema