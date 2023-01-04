import joi from 'joi';

export const postSchema = joi.object({
  link: joi.string().uri().required(),
  message: joi.string().min(1).max(1000)
});
