import joi from 'joi';

export const postSchema = joi.object({
  link: joi.string().uri(),
  message: joi.string().min(1).max(1000).required()
});
