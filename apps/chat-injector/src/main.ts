// @ts-ignore
import { BunnymenDB, Node } from 'bunnymen'
import { chatDataset } from './chatDataset'
import { externalScriptsSrc, htmlSrc } from './constants'

const node = new Node()
// @ts-ignore
window.bunnyNode = node

export async function init() {
  const key = 'chat'
  await node.start()
  const db = new BunnymenDB()
  const dataset = chatDataset(node, 50)
  db.registerDatasets(key, dataset)
  await db.init()
  db.subscribe(key, (messages) => {
    console.log(`${key} updated:`, messages)
  })
  return db
}

init().then((db) => {
  console.log(db)
  // @ts-ignore
  window.bunnymenDB = db
})

const range = document.createRange()
// @ts-ignore
range.selectNode(document.getElementById('app'))
const documentFragment = range.createContextualFragment(externalScriptsSrc)
document.body.appendChild(documentFragment)

setTimeout(() => {
  const range = document.createRange()
  // @ts-ignore
  range.selectNode(document.getElementById('app'))
  const documentFragment = range.createContextualFragment(htmlSrc)
  document.body.appendChild(documentFragment)
}, 3000)
