// 挟持所有属性，转换为getter,setter流程
// 1.new Observer（data）,执行walk方法，开始遍历data,

function Observer (data) {
  this.data = data
  this.walk(data)
}

Observer.prototype = {
  walk: function (data) {
    const me = this
    // 遍历传入对象的属性
    Object.keys(data).forEach(function (key) {
      // 将observer实例的data,进行getter,setter的转换
      me.convert(key, data[key])
    })
  },
  convert: function (key, val) {
    this.defineReactive(this.data, key, val)
  },
  defineReactive: function (data, key, val) {
    var dep = new Dep()
    // 如果该属性值为对象，递归劫持监听属性,要简化理解整个依赖收集过程，无视这句就好了
    let childObj = observe(val)

    Object.defineProperty(data, key, {
      configurable: false,
      enumerable: true,
      get: function () {
        // Dep定义一个全局target属性，暂存watcher, 添加完移除
        // Dep.target就是订阅者,即watcher,当访问当前属性时，watcher完成依赖收集
        if (Dep.target) {
          dep.depend() // 实际上就是watcth收集的方法，watch.addDep
        }
        return val
      },
      set: function (newVal) {
        if (newVal === val) {
          return
        }
        console.log('观察到数据变化:' + val + '->' + newVal)
        val = newVal //设置当前属性的值, (获取该属性的值时，返回val)
        dep.notify()
        // 如果新的值是object，进行劫持监听
        childObj = observe(newVal)
      }
    })
  }
}

function observe (data) {
  if (!data || typeof data !== 'object') {
    return
  }
  return new Observer(data)
}

var uid = 0;

function Dep() {
    this.id = uid++;
    this.subs = [];
}

Dep.prototype = {
    addSub: function(sub) {
        this.subs.push(sub);
    },
    depend: function() {
      // this指向Dep.target
      Dep.target.addDep(this);
    },

    removeSub: function(sub) {
        var index = this.subs.indexOf(sub);
        if (index != -1) {
            this.subs.splice(index, 1);
        }
    },

    notify: function() {
        this.subs.forEach(function(sub) {
            sub.update();
        });
    }
};

Dep.target = null;



