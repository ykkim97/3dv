(module
  ;; Minimal demo module for JS/Vite integration.
  ;; Exports a single function: add(a: i32, b: i32) -> i32
  (func $add (param $a i32) (param $b i32) (result i32)
    local.get $a
    local.get $b
    i32.add
  )
  (export "add" (func $add))
)
