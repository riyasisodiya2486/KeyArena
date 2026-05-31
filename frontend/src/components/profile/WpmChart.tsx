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
        <CartesianGrid strokeDasharray="3 3" stroke="#303035" />
        <XAxis dataKey="date"
          tick={{fill:"#6B6A67",fontSize:11}}
          axisLine={false} tickLine={false} />
        <YAxis
          tick={{fill:"#6B6A67",fontSize:11}}
          axisLine={false} tickLine={false}
          domain={["auto","auto"]} />
        <Tooltip
          contentStyle={{
            background:"#1E1E21",
            border:"1px solid #303035",
            borderRadius:"8px",
            color:"#F2F1EE"
          }}
          formatter={(v:number) => [`${v} wpm`,"Speed"]}
        />
        <Line type="monotone" dataKey="wpm"
          stroke="#E8593C" strokeWidth={2}
          dot={{fill:"#E8593C",r:3}}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}