export interface ByteWithTime {
  byte: number;
  time: string;
}

export interface ParsedCommand {
  index: number;
  startTime: string;
  deviceAddr: number;
  isBroadcast: boolean;
  isWrite: boolean;
  length: number;
  regAddr: number;
  regName: string;
  data: number[];
  crc: number;
  description: string;
}

const getRegisterName = (addr: number): string => {
  if (addr >= 0 && addr <= 0x17) {
    const ch = Math.floor(addr / 3);
    const sub = addr % 3 === 0 ? "A" : addr % 3 === 1 ? "B" : "C";
    return `PWMH${ch}${sub}`;
  }
  if (addr >= 0x20 && addr <= 0x37) {
    const ch = Math.floor((addr - 0x20) / 3);
    const sub = (addr - 0x20) % 3 === 0 ? "A" : (addr - 0x20) % 3 === 1 ? "B" : "C";
    return `PWML${ch}${sub}`;
  }
  if (addr >= 0x40 && addr <= 0x43) return `ENOUT${addr - 0x40}`;
  if (addr === 0x44) return `SHAREPWM`;
  if (addr >= 0x50 && addr <= 0x67) {
    const ch = Math.floor((addr - 0x50) / 3);
    const sub = (addr - 0x50) % 3 === 0 ? "A" : (addr - 0x50) % 3 === 1 ? "B" : "C";
    return `IOUT${ch}${sub}`;
  }
  if (addr >= 0x70 && addr <= 0x73) return `DENOUT${addr - 0x70}`;
  if (addr >= 0x74 && addr <= 0x77) return `SLSMAP${addr - 0x74}`;
  if (addr === 0x78) return `SLSTH0`;
  if (addr === 0x79) return `SLSTH1`;
  if (addr === 0x7A) return `MISC`;
  if (addr === 0x7B) return `DIAG`;
  if (addr === 0x7C) return `MASKDIAG`;
  if (addr === 0x7D) return `MASKOUT`;
  if (addr === 0x7E) return `DIM`;
  if (addr >= 0x80 && addr <= 0x83) return `FSMAP${addr - 0x80}`;
  if (addr >= 0x84 && addr <= 0x86) return `ITF${addr - 0x84}`;
  if (addr === 0x87) return `CRC`;
  if (addr === 0x90) return `ADCCH`;
  if (addr === 0x91) return `CLR`;
  if (addr === 0x92) return `DEBUG`;
  if (addr === 0x93) return `LOCK`;
  if (addr === 0x94) return `RESET`;
  if (addr === 0x95) return `CTRL-R`;
  if (addr === 0x96) return `CTRLGATE`;
  if (addr === 0x97) return `EEP`;
  if (addr === 0x98) return `EEPGATE`;
  if (addr === 0x9F) return `ODREADY`;
  if (addr === 0xA0) return `FLAG_ERR`;
  if (addr === 0xA1) return `FLAG_STATUS`;
  if (addr === 0xA2) return `ADC_OUT`;
  if (addr >= 0xA3 && addr <= 0xA6) return `FLAG_SLS${addr - 0xA3}`;
  if (addr >= 0xA7 && addr <= 0xAA) return `FLAG_OPEN${addr - 0xA7}`;
  if (addr >= 0xAB && addr <= 0xAE) return `FLAG_SHORT${addr - 0xAB}`;
  if (addr === 0xAF) return `CALC_EEPCRC`;
  if (addr === 0xC0) return `OPENTH`;
  if (addr === 0xC1) return `SHORTTH`;
  if (addr === 0xC2) return `TEMPTH`;
  if (addr >= 0xC3 && addr <= 0xC5) return `USER${addr - 0xC3}`;
  return `保留/未知`;
};

const hexPad = (num: number) => "0x" + num.toString(16).toUpperCase().padStart(2, "0");

const generateDescription = (isWrite: boolean, length: number, regAddr: number, regName: string, data: number[]): string => {
  const opStr = isWrite ? "写入" : "读取";
  const modeStr = length === 1 ? "单" : `连续${length}`;
  const dataStr = data.map(hexPad).join(", ");
  
  let feature = "";
  
  let enoutFound = false;
  let enabledChs: string[] = [];
  for (let i = 0; i < data.length; i++) {
      const a = regAddr + i;
      if (a >= 0x40 && a <= 0x43) {
          enoutFound = true;
          const enoutIdx = a - 0x40;
          const g0 = enoutIdx * 2;
          const g1 = enoutIdx * 2 + 1;
          const d = data[i];
          if (d & 0x01) enabledChs.push(`OUT${g0}A`);
          if (d & 0x02) enabledChs.push(`OUT${g0}B`);
          if (d & 0x04) enabledChs.push(`OUT${g0}C`);
          if (d & 0x10) enabledChs.push(`OUT${g1}A`);
          if (d & 0x20) enabledChs.push(`OUT${g1}B`);
          if (d & 0x40) enabledChs.push(`OUT${g1}C`);
      }
  }
  if (enoutFound && data.length > 0) {
      if (enabledChs.length > 0) {
          feature = `，使能通道: ${enabledChs.join(", ")}`;
      } else {
          feature = `，关闭涉及的通道`;
      }
  }

  if (length === 1) {
     if (!feature) {
         if (regName.startsWith("PWMH")) feature = "，配置高8位PWM占空比";
         else if (regName.startsWith("PWML")) feature = "，配置低4位PWM占空比";
         else if (regName.startsWith("IOUT")) feature = "，配置输出电流";
         else if (regName.startsWith("ENOUT")) feature = "，配置通道使能";
     }

     return `对 ${hexPad(regAddr)} (${regName}) 寄存器${modeStr}字节${opStr} ${dataStr}${feature}。`;
  }
  
  if (feature) {
      return `对 ${hexPad(regAddr)} (${regName}) 及后续寄存器${modeStr}字节连续${opStr}，数据项为 [ ${dataStr} ]${feature}。`;
  }

  return `对 ${hexPad(regAddr)} (${regName}) 及后续寄存器${modeStr}字节连续${opStr}，数据项为 [ ${dataStr} ]。`;
};

export function extractDataFromCsv(csvText: string): ByteWithTime[] {
  const lines = csvText.split('\n');
  const extracted: ByteWithTime[] = [];
  
  let valueColIndex = -1;
  let timeColIndex = -1;
  
  if (lines.length > 0) {
    const headers = lines[0].toLowerCase().split(',').map(h => h.trim().replace(/^['"]|['"]$/g, ''));
    valueColIndex = headers.findIndex(h => h === 'value' || h === 'data');
    timeColIndex = headers.findIndex(h => h === 'time' || h === 'time [s]' || h === 'timestamp' || h.includes('time'));
  }

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const columns = line.split(',').map(c => c.trim().replace(/^['"]|['"]$/g, ''));

    let matchStr = "";
    if (valueColIndex >= 0 && valueColIndex < columns.length) {
      matchStr = columns[valueColIndex];
    } else {
      for (const col of columns) {
        if (/^(?:0x)?[0-9A-Fa-f]+$/.test(col)) {
          matchStr = col;
          break;
        }
      }
    }

    let timeStr = "";
    if (timeColIndex >= 0 && timeColIndex < columns.length) {
       timeStr = columns[timeColIndex];
    } else {
       if (/^-?\d+(?:\.\d+)?(?:[eE]-?\d+)?$/.test(columns[0])) {
           timeStr = columns[0];
       }
    }

    const match = matchStr.match(/(?:0x)?([0-9A-Fa-f]+)/i);
    if (match && match[1]) {
      extracted.push({
         byte: parseInt(match[1], 16),
         time: timeStr
      });
    }
  }
  return extracted;
}

export function parseProtocol(bytesData: ByteWithTime[]): ParsedCommand[] {
  const SYNC = 0x55;
  const frames: ParsedCommand[] = [];
  
  let state = 'WAIT_SYNC';
  let currentFrame: any = null;
  let dataBytesLeft = 0;
  let responseBytesToSkip = 0;
  let index = 1;

  for (let i = 0; i < bytesData.length; i++) {
    const { byte, time } = bytesData[i];

    switch(state) {
      case 'WAIT_SYNC':
        if (byte === SYNC) {
          currentFrame = { data: [], startTime: time };
          state = 'DEVID';
        }
        break;

      case 'DEVID':
        currentFrame.devid = byte;
        const lengthMode = (byte >> 4) & 0x03;
        currentFrame.isWrite = ((byte >> 7) & 0x01) === 1;
        currentFrame.isBroadcast = ((byte >> 6) & 0x01) === 1;
        currentFrame.deviceAddr = byte & 0x0F;
        currentFrame.length = lengthMode === 0 ? 1 : lengthMode === 1 ? 4 : lengthMode === 2 ? 16 : 24;
        dataBytesLeft = currentFrame.length;
        state = 'REGADDR';
        break;

      case 'REGADDR':
        currentFrame.regAddr = byte;
        currentFrame.regName = getRegisterName(byte);
        if (currentFrame.isWrite) {
          state = 'DATA';
        } else {
          state = 'READ_MCU_CRC';
        }
        break;

      case 'READ_MCU_CRC':
        // For Read, the MCU sends a CRC byte after REGADDR, then the Device responds with DATA.
        // We skip this CRC byte and start looking for device response DATA.
        state = 'DATA';
        break;

      case 'DATA':
        currentFrame.data.push(byte);
        dataBytesLeft--;
        if (dataBytesLeft === 0) {
          state = 'CRC';
        }
        break;

      case 'CRC':
        currentFrame.crc = byte;
        currentFrame.index = index++;
        currentFrame.description = generateDescription(
          currentFrame.isWrite, 
          currentFrame.length, 
          currentFrame.regAddr, 
          currentFrame.regName, 
          currentFrame.data
        );
        frames.push(currentFrame as ParsedCommand);

        if (currentFrame.isBroadcast) {
           responseBytesToSkip = 0;
        } else if (currentFrame.isWrite) {
           responseBytesToSkip = 2; // STATUS + CRC
        } else {
           responseBytesToSkip = 0; // DATA + CRC already parsed in READ path
        }

        if (responseBytesToSkip > 0) {
           state = 'SKIP_RESPONSE';
        } else {
           state = 'WAIT_SYNC';
        }
        break;

      case 'SKIP_RESPONSE':
        responseBytesToSkip--;
        if (responseBytesToSkip === 0) {
          state = 'WAIT_SYNC';
        }
        break;
    }
  }

  return frames;
}

export function exportToCsv(commands: ParsedCommand[]): string {
  const headers = ['序号', '起始时间', '类型', '设备地址', '广播命令', '寄存器地址', '寄存器名称', '数据 (Hex)', 'CRC', '命令功能自然语言解析'];
  const rows = commands.map(cmd => [
    cmd.index.toString(),
    cmd.startTime || '',
    cmd.isWrite ? '写入' : '读取',
    hexPad(cmd.deviceAddr),
    cmd.isBroadcast ? '是' : '否',
    hexPad(cmd.regAddr),
    cmd.regName,
    cmd.data.map(hexPad).join(' '),
    hexPad(cmd.crc),
    cmd.description
  ]);

  const escapeCsv = (str: string) => `"${str.replace(/"/g, '""')}"`;
  
  const csvContent = [
    headers.map(escapeCsv).join(','),
    ...rows.map(row => row.map(escapeCsv).join(','))
  ].join('\n');

  // Prefix with BOM for Excel UTF-8 display compatibility
  return '\uFEFF' + csvContent;
}
