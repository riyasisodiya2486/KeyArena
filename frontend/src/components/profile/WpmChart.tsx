"use client";
import { LineChart, Line, XAxis, YAxis,
         Tooltip, ResponsiveContainer, CartesianGrid
} from "recharts";

export function WpmChart({
  data
}: {
  data: { date: string; wpm: number }[]
}) {
  if (!data.length)
    return <p>Complete some races to see progress.</p>;

  return (
    <ResponsiveContainer width="100%" height={180}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2E" />
        <XAxis dataKey="date"
          tick={{fill:"#807D76",fontSize:11}}
          axisLine={false} tickLine={false} />
        <YAxis
          tick={{fill:"#807D76",fontSize:11}}
          axisLine={false} tickLine={false}
          domain={["auto","auto"]} />
        <Tooltip
          contentStyle={{
            background:"#19191C",
            border:"1px solid #2A2A2E",
            borderRadius:"8px",
            color:"#F2EEE6"
          }}
          formatter={(v:number) => [`${v} wpm`,"Speed"]}
        />
        <Line type="monotone" dataKey="wpm"
          stroke="#E45B46" strokeWidth={2}
          dot={{fill:"#E45B46",r:3}}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
