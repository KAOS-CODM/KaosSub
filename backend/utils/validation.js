const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const validatePhone = (phone) => {
  const phoneRegex = /^[0-9]{11}$/;
  return phoneRegex.test(phone);
};

const validateAmount = (amount) => {
  return !isNaN(amount) && amount >= 100;
};

module.exports = {
  validateEmail,
  validatePhone,
  validateAmount
};
