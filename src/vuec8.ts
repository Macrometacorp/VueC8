import Vue, { PluginObject } from 'vue'
import jsc8, { Fabric, DocumentCollection } from 'jsc8'
import { bindCollection, bindDocument } from './c8db'
import { OptionType, OperationsType, C8DbBindObjectRef, C8DbBindOption, C8Document } from './types'
import { walkSet, setTenantUrl } from './utils'

// Type Declaration ------------------------------------------------------------

declare module 'vue' {
  interface VueConstructor {
    $fabric: Fabric
  }
}

declare module 'vue/types/options' {
  interface ComponentOptions<V extends Vue> {
    c8db?: C8DbBindOption<V>
  }
}

declare module 'vue/types/vue' {
  interface Vue {
    $bind(name: string, reference: C8DbBindObjectRef): Promise<any>
    $unbind: (name: string) => void
    $c8Refs: Record<string, { _collection?: DocumentCollection; _fabric?: Fabric }>
  }
}

// ---------------------------------------------------------------------------

let isAuthenticated = false
let isAuthenticating = false

// Helper Fn -------------------------------------------------------------------

const ops: OperationsType = {
  set: (target, key, value) => walkSet(target, key, value),
  add: (array, index, data) => array.splice(index, 0, data),
  remove: (array, index) => array.splice(index, 1),
}

function bind(vm: Vue, key: string, ref: C8DbBindObjectRef, fabric: Fabric, ops: OperationsType) {
  return new Promise((resolve, reject) => {
    if (typeof ref === 'string') {
      if (ref.includes('/')) {
        bindDocument(vm, key, ref, fabric, resolve, reject, ops)
      } else {
        bindCollection(vm, key, ref, fabric, resolve, reject, ops)
      }
    } else if (typeof ref === 'object') {
      if (ref.documentId) {
        bindDocument(vm, key, ref, fabric, resolve, reject, ops)
      } else {
        bindCollection(vm, key, ref, fabric, resolve, reject, ops)
      }
    }
  })
}

function isFabricAvailable(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!isAuthenticating && !isAuthenticated) {
      reject()
    }

    if (isAuthenticated) {
      resolve()
    }

    function checkAuth() {
      if (!isAuthenticating && !isAuthenticated) {
        reject()
      }

      if (isAuthenticated) {
        resolve()
      } else {
        setTimeout(checkAuth, 500)
      }
    }

    checkAuth()
  })
}

// Login Fn --------------------------------------------------------------------

const getFabric = async (opts?: OptionType): Promise<Fabric> => {
  return new Promise((resolve, reject) => {
    if (opts && Object.keys(opts).length) {
      const {
        config,
        auth: { email, password },
      } = opts

      const fabric: Fabric = jsc8(`https://${setTenantUrl(config)}`)

      fabric
        .login(email, password)
        .then(() => {
          if (opts.fabricName) {
            fabric.useFabric(opts.fabricName)
          }
          resolve(fabric)
        })
        .catch(reject)
    } else {
      reject()
    }
  })
}

// Plugin Fn -------------------------------------------------------------------

export const vuec8: PluginObject<OptionType> = {
  install: function jsc8Plugin(Vue, opts) {
    const strategies = Vue.config.optionMergeStrategies
    strategies.c8db = strategies.provide

    // Authentication jsc8 -----------------

    isAuthenticating = true
    isAuthenticated = false

    getFabric(opts).then(fabricInstance => {
      isAuthenticated = true
      isAuthenticating = false

      Vue.$fabric = fabricInstance
    })

    // -------------------------------------

    Vue.prototype.$bind = async function jsc8Bind(this: Vue, key: string, ref: C8DbBindObjectRef) {
      let fabric: Fabric

      if (typeof ref === 'string') {
        await isFabricAvailable()
      } else {
        if (ref.fabricName) {
          //@ts-ignore
          const newOpts: OptionType = { ...opts, fabricName: ref.fabricName }
          fabric = await getFabric(newOpts)
        } else {
          await isFabricAvailable()
        }
      }

      //@ts-ignore
      const promise = bind(this, key, ref, fabric || Vue.$fabric, ops)
      return promise
    }

    Vue.mixin({
      beforeCreate(this: Vue) {
        this.$c8Refs = Object.create(null)
      },

      created(this: Vue) {
        const { c8db } = this.$options

        if (c8db) {
          const refs = typeof c8db === 'function' ? c8db.call(this) : c8db

          if (!refs) return

          for (const key in refs) {
            // @ts-ignore
            this.$bind(key, refs[key])
          }
        }
      },

      beforeDestroy(this: Vue) {
        for (const key in this.$c8Refs) {
          //@ts-ignore
          this.$c8Refs[key]._collection.closeOnChangeConnection()
        }

        //@ts-ignore
        this.$c8Refs = null
      },
    })
  },
}
