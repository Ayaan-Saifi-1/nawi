export default function health(_request, response) {
  return response.status(200).json({ status: 'healthy' });
}
