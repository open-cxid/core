export function hexToUint8Array(hexString: string): Uint8Array {
  const arr = new Uint8Array(hexString.length / 2)
  for (let i = 0; i < hexString.length; i += 2) {
    arr[i / 2] = parseInt(hexString.substring(i, i + 2), 16)
  }
  return arr
}

export function uint8ArrayToHex(array: Uint8Array): string {
  let result = ''
  for (let i = 0; i < array.length; i++) {
    result += array[i].toString(16).padStart(2, '0')
  }
  return result
}
