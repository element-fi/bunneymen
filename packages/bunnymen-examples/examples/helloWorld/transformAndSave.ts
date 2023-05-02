import { BunnymenDB, Dataset, Loader, Node } from 'bunnymen'

const node = new Node()
const db = new BunnymenDB()

const greetingDataset = new Dataset(node, () => 'Hello', new Loader())
const subjectDataset = new Dataset(node, () => 'World', new Loader())

db.registerDatasets('statement', greetingDataset, subjectDataset)
db.registerTransformer(
  'statement',
  (greeting, subject) => `${greeting.data}, ${subject.data}!`,
)

const savedStatementDataset = new Dataset(node, () => '', new Loader())
db.registerDatasets('savedStatement', savedStatementDataset)

async function main() {
  await db.init()
  const statement = await db.get('statement')
  console.log(statement)
}

main()
