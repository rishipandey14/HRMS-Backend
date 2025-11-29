function parsePagination(query) {
  let page = parseInt(query.page, 10) || 1;
  let limit = parseInt(query.limit, 10) || 50;
  if (page < 1) page = 1;
  if (limit < 1 || limit > 100) limit = 50;
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}
module.exports = parsePagination;
