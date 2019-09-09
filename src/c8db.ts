import Vue from 'vue'
import { setTenantUrl, filterQuery, filterDocument } from './utils'
import { C8DbBindObjectRef, FilterObject, C8Document, OperationsType } from './types'
import { Fabric, ArrayCursor } from 'jsc8'

function SubscribeToChange(
  vm: Vue,
  fabric: Fabric,
  collection: string,
  key: string,
  callback: (document: C8Document) => void
) {
  const collectionRef = fabric.collection(collection)

  vm.$c8Refs[key] = { _collection: collectionRef, _fabric: fabric }

  collectionRef.onChange(
    {
      onmessage: function msg(msg: string) {
        // Retriving the payload object from msg Object
        const document = JSON.parse(atob(JSON.parse(msg).payload))

        callback(document)
      },
      onerror: console.error,
    },
    //@ts-ignore
    setTenantUrl(fabric._connection._urls).split('//')[1],
    `vuec8${Math.floor(Math.random() * Math.floor(99999))}`
  )

  return collectionRef
}

export function bindCollection(
  vm: Vue,
  key: string,
  collectionRef: C8DbBindObjectRef,
  fabric: Fabric,
  resolve: () => void,
  reject: () => void,
  ops: OperationsType
) {
  let ref
  let filter: FilterObject[] = []

  if (typeof collectionRef === 'string') {
    ref = collectionRef
  } else {
    ref = collectionRef.collection
    filter = collectionRef.filter || []
  }

  ops.set(vm, key, [])

  SubscribeToChange(vm, fabric, ref, key, function callback(newDocument) {
    // @ts-ignore
    const data = vm[key]

    // Finding the index of document in the array.
    const index = data.findIndex((document: C8Document) => document._key === newDocument._key)

    //If there is no filter filterDocument() will return true.
    const isFilteredDocument = filterDocument(filter, newDocument)

    // Added or Updation the document based on the index.
    if (index > -1 && newDocument._delete == true) {
      ops.remove(data, index)
    } else {
      if (index < 0 && isFilteredDocument) {
        ops.add(data, 0, newDocument)
      }

      // if (index < 0 && !isFilteredDocument) {
      //   This case does not exist
      // }

      if (index > -1 && isFilteredDocument) {
        ops.remove(data, index)
        ops.add(data, index, newDocument)
      }

      if (index > -1 && !isFilteredDocument) {
        ops.remove(data, index)
      }
    }
  })

  fabric
    .query(`FOR doc in ${ref} ${filterQuery(filter, 'doc')} return doc`)
    .then((cursor: ArrayCursor) => {
      cursor.all().then((data: C8Document[]) => {
        ops.set(vm, key, data)
        resolve()
      })
    })
    .catch(reject)
}

export function bindDocument(
  vm: Vue,
  key: string,
  documentRef: C8DbBindObjectRef,
  fabric: Fabric,
  resolve: () => void,
  reject: () => void,
  ops: OperationsType
) {
  let ref: string
  let collection: string
  let filter: FilterObject[] = []

  if (typeof documentRef === 'string') {
    collection = documentRef.split('/')[0]
    ref = documentRef.split('/')[1]
  } else {
    //@ts-ignore
    ref = documentRef.documentId
    collection = documentRef.collection
    filter = documentRef.filter || []
  }

  ops.set(vm, key, {})

  SubscribeToChange(vm, fabric, collection, key, function msg(newDocument: C8Document) {
    if (newDocument._delete == true) {
      ops.set(vm, key, {})
    } else {
      if (newDocument._key === ref && filterDocument(filter, newDocument)) {
        ops.set(vm, key, newDocument)
      }

      if (newDocument._key === ref && !filterDocument(filter, newDocument)) {
        ops.set(vm, key, {})
      }
    }
  })

  //@ts-ignore
  vm.$c8Refs[key]._collection
    .document(ref)
    .then((document: C8Document) => {
      if (filterDocument(filter, document)) {
        ops.set(vm, key, document)
        resolve()
      } else {
        reject()
      }
    })
    .catch(reject)
}
